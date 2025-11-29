import { injectable, inject } from 'tsyringe';
import { PrismaClient, ImportStatus } from '@prisma/client';
import * as XLSX from 'xlsx';
import { subMonths, addMonths, startOfMonth, format } from 'date-fns';
import { ISiqImportService, type ImportProgressCallback } from '@/services/ISiqImportService';
import { ImportLogModel } from '@/contracts/models/siq-import.model';
import { ImportLogDto, ImportResultDto, ImportStatsDto } from '@/contracts/dtos/siq-import.dto';

/**
 * Column mapping from SIQ Excel to our normalized schema
 */
const COLUMN_MAP = {
  // Site
  siteCode: 'Column1.SiteCode',
  company: 'Column1.Company',

  // Supplier
  supplierCode: 'Column1.PrimarySupplierCode',
  supplierName: 'Column1.PrimarySupplierName',

  // Item
  itemCode: 'Column1.ItemCode',
  itemDescription: 'Column1.ItemDescription',
  categoryClass: 'Column1.Category Class',
  zone: 'Column1.Zone',
  erpStatus: 'Column1.Erp Item Status',
  abcClass: 'Column1.ABC Class',
  shelfLife: 'Column1.Shelf Life',
  leadTime: 'Column1.Active Planning LT',
  conditionalStatus: 'Column1.Conditional Status',
  challengeStatus: 'Column1.Challange Status', // Note: typo in source data

  // Inventory
  onHandQty: 'Column1.On Hand Quantity',
  safetyStock: 'Column1.Safety Stock',
  onOrder: 'Column1.On Order',
  openSales: 'Column1.Open Sales',
  openEstimates: 'Column1.Open Estimates',
  targetStock: 'Column1.Target Stock',
  preferredMax: 'Column1.Preferred Max',
  maxStock: 'Column1.Max Stock',
  weeksSupply: 'Column1.Weeks Supply Onhand',
  nextPoDate: 'Column1.Next PO Date',
  nextPoQty: 'Column1.Next PO Quantity',

  // Sales Actuals
  monthMinus3: 'Column1.Month -3 Actuals',
  monthMinus2: 'Column1.Month -2 Actuals',
  lastMonth: 'Column1.Last Month Actuals',
  currentMonthSales: 'Column1.Current Month Sales',
  lastSyActuals: 'Column1.Last SY Actuals (Aug - May)',
  currentSyActuals: 'Column1.Current SY Actuals (Aug - May)',

  // Forecasts
  currentMonthForecast: 'Column1.Current Month Forecast',
  monthPlus1: 'Column1.Month +1 Forecast',
  monthPlus2: 'Column1.Month +2 Forecast',
  monthPlus3: 'Column1.Month +3 Forecast',
  monthPlus4: 'Column1.Month +4 Forecast',
  forecastVariance: 'Column1.Forecast Variance MTD',
  supplyVariance: 'Column1.Supply Variance',

  // Customer Metrics
  totalCustomers: 'Column1.Total Customers',
  topCustomers: "Column1.Top 5 Customer Ship-To's",
  buyer: 'Column1.Buyer',
} as const;

/**
 * Required columns that must be present in the Excel file
 */
const REQUIRED_COLUMNS = [
  // Site & Supplier (required)
  COLUMN_MAP.siteCode,
  COLUMN_MAP.company,
  COLUMN_MAP.itemCode,
  COLUMN_MAP.itemDescription,

  // Optional but expected columns
  COLUMN_MAP.supplierCode,
  COLUMN_MAP.supplierName,
  COLUMN_MAP.categoryClass,
  COLUMN_MAP.zone,
  COLUMN_MAP.erpStatus,
  COLUMN_MAP.abcClass,
  COLUMN_MAP.shelfLife,
  COLUMN_MAP.leadTime,
  COLUMN_MAP.conditionalStatus,
  COLUMN_MAP.challengeStatus,

  // Inventory columns
  COLUMN_MAP.onHandQty,
  COLUMN_MAP.safetyStock,
  COLUMN_MAP.onOrder,
  COLUMN_MAP.openSales,
  // Note: openEstimates, nextPoDate, nextPoQty are optional - not in all Excel exports
  COLUMN_MAP.targetStock,
  COLUMN_MAP.preferredMax,
  COLUMN_MAP.maxStock,
  COLUMN_MAP.weeksSupply,

  // Sales Actuals
  COLUMN_MAP.monthMinus3,
  COLUMN_MAP.monthMinus2,
  COLUMN_MAP.lastMonth,
  COLUMN_MAP.currentMonthSales,
  COLUMN_MAP.lastSyActuals,
  COLUMN_MAP.currentSyActuals,

  // Forecasts
  COLUMN_MAP.currentMonthForecast,
  COLUMN_MAP.monthPlus1,
  COLUMN_MAP.monthPlus2,
  COLUMN_MAP.monthPlus3,
  COLUMN_MAP.monthPlus4,
  COLUMN_MAP.forecastVariance,
  COLUMN_MAP.supplyVariance,

  // Customer Metrics
  COLUMN_MAP.totalCustomers,
  COLUMN_MAP.topCustomers,
  COLUMN_MAP.buyer,
];

interface SiqRow {
  [key: string]: unknown;
}

@injectable()
export class SiqImportService implements ISiqImportService {
  constructor(
    @inject('PrismaClient') private readonly prisma: PrismaClient
  ) {}

  private toImportLogDto(model: ImportLogModel): ImportLogDto {
    return {
      id: model.id,
      fileName: model.fileName,
      importDate: model.importDate.toISOString(),
      status: model.status,
      rowsProcessed: model.rowsProcessed,
      rowsCreated: model.rowsCreated,
      rowsUpdated: model.rowsUpdated,
      rowsFailed: model.rowsFailed,
      errorLog: model.errorLog,
      createdAt: model.createdAt.toISOString(),
      completedAt: model.completedAt?.toISOString() ?? null,
    };
  }

  /**
   * Validate that all required columns are present in the Excel file
   */
  private validateColumns(headers: string[]): { valid: boolean; missing: string[] } {
    const missing = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
    return {
      valid: missing.length === 0,
      missing,
    };
  }

  async importFromBuffer(
    buffer: Buffer,
    fileName: string,
    importDate: Date
  ): Promise<ImportResultDto> {
    // Create import log entry
    const importLog = await this.prisma.importLog.create({
      data: {
        fileName,
        importDate,
        status: ImportStatus.IN_PROGRESS,
      },
    });

    const stats: ImportStatsDto = {
      rowsProcessed: 0,
      sitesCreated: 0,
      sitesUpdated: 0,
      suppliersCreated: 0,
      suppliersUpdated: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      inventorySnapshotsCreated: 0,
      salesActualsCreated: 0,
      salesActualsUpdated: 0,
      forecastsCreated: 0,
      forecastsUpdated: 0,
      customerMetricsCreated: 0,
    };
    const errors: string[] = [];

    try {
      // Parse Excel file
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error('Excel file contains no sheets');
      }
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        throw new Error('Failed to read sheet from Excel file');
      }
      const rows: SiqRow[] = XLSX.utils.sheet_to_json(sheet);

      // Validate required columns
      if (rows.length > 0) {
        const firstRow = rows[0];
        if (firstRow) {
          const headers = Object.keys(firstRow);
          const validation = this.validateColumns(headers);
          if (!validation.valid) {
            throw new Error(`Missing required columns: ${validation.missing.join(', ')}`);
          }
        }
      }

      // Cache for sites and suppliers to avoid repeated lookups
      const siteCache = new Map<string, string>(); // code -> id
      const supplierCache = new Map<string, string>(); // code -> id

      // Process in batches
      const BATCH_SIZE = 500;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);

        for (const row of batch) {
          try {
            await this.processRow(row, importDate, stats, siteCache, supplierCache);
            stats.rowsProcessed++;
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            errors.push(`Row ${i + batch.indexOf(row) + 1}: ${errorMsg}`);
          }
        }
      }

      // Update import log with success
      await this.prisma.importLog.update({
        where: { id: importLog.id },
        data: {
          status: ImportStatus.COMPLETED,
          rowsProcessed: stats.rowsProcessed,
          rowsCreated:
            stats.sitesCreated +
            stats.suppliersCreated +
            stats.itemsCreated +
            stats.inventorySnapshotsCreated +
            stats.salesActualsCreated +
            stats.forecastsCreated +
            stats.customerMetricsCreated,
          rowsUpdated:
            stats.sitesUpdated +
            stats.suppliersUpdated +
            stats.itemsUpdated +
            stats.salesActualsUpdated +
            stats.forecastsUpdated,
          rowsFailed: errors.length,
          errorLog: errors.length > 0 ? errors.slice(0, 100).join('\n') : null,
          completedAt: new Date(),
        },
      });

      return {
        importId: importLog.id,
        status: 'COMPLETED',
        stats,
        errors: errors.length > 0 ? errors.slice(0, 100) : undefined,
        completedAt: new Date().toISOString(),
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      // Update import log with failure
      await this.prisma.importLog.update({
        where: { id: importLog.id },
        data: {
          status: ImportStatus.FAILED,
          rowsProcessed: stats.rowsProcessed,
          errorLog: errorMsg,
          completedAt: new Date(),
        },
      });

      return {
        importId: importLog.id,
        status: 'FAILED',
        stats,
        errors: [errorMsg],
        completedAt: new Date().toISOString(),
      };
    }
  }

  private async processRow(
    row: SiqRow,
    importDate: Date,
    stats: ImportStatsDto,
    siteCache: Map<string, string>,
    supplierCache: Map<string, string>
  ): Promise<void> {
    const siteCode = String(row[COLUMN_MAP.siteCode] ?? '').trim();
    const company = String(row[COLUMN_MAP.company] ?? '').trim();
    const itemCode = String(row[COLUMN_MAP.itemCode] ?? '').trim();

    if (!siteCode || !itemCode) {
      throw new Error('Missing required fields: siteCode or itemCode');
    }

    // 1. Upsert Site
    let siteId = siteCache.get(siteCode);
    if (!siteId) {
      const site = await this.prisma.site.upsert({
        where: { code: siteCode },
        update: { company },
        create: { code: siteCode, company },
      });
      siteId = site.id;
      siteCache.set(siteCode, siteId);

      if (site.createdAt.getTime() === site.updatedAt.getTime()) {
        stats.sitesCreated++;
      } else {
        stats.sitesUpdated++;
      }
    }

    // 2. Upsert Supplier (if present)
    let supplierId: string | null = null;
    const supplierCode = String(row[COLUMN_MAP.supplierCode] ?? '').trim();
    if (supplierCode) {
      supplierId = supplierCache.get(supplierCode) ?? null;
      if (!supplierId) {
        const supplierName = String(row[COLUMN_MAP.supplierName] ?? '').trim();
        const supplier = await this.prisma.supplier.upsert({
          where: { code: supplierCode },
          update: { name: supplierName || supplierCode },
          create: { code: supplierCode, name: supplierName || supplierCode },
        });
        supplierId = supplier.id;
        supplierCache.set(supplierCode, supplierId);

        if (supplier.createdAt.getTime() === supplier.updatedAt.getTime()) {
          stats.suppliersCreated++;
        } else {
          stats.suppliersUpdated++;
        }
      }
    }

    // 3. Upsert Item
    const item = await this.prisma.item.upsert({
      where: { siteId_code: { siteId, code: itemCode } },
      update: {
        description: String(row[COLUMN_MAP.itemDescription] ?? ''),
        categoryClass: this.toStringOrNull(row[COLUMN_MAP.categoryClass]),
        zone: this.toStringOrNull(row[COLUMN_MAP.zone]),
        erpStatus: this.toStringOrNull(row[COLUMN_MAP.erpStatus]),
        abcClass: this.toStringOrNull(row[COLUMN_MAP.abcClass]),
        shelfLifeDays: this.toIntOrNull(row[COLUMN_MAP.shelfLife]),
        leadTimeDays: this.toIntOrNull(row[COLUMN_MAP.leadTime]),
        conditionalStatus: this.toStringOrNull(row[COLUMN_MAP.conditionalStatus]),
        challengeStatus: this.toStringOrNull(row[COLUMN_MAP.challengeStatus]),
        supplierId,
      },
      create: {
        code: itemCode,
        description: String(row[COLUMN_MAP.itemDescription] ?? ''),
        categoryClass: this.toStringOrNull(row[COLUMN_MAP.categoryClass]),
        zone: this.toStringOrNull(row[COLUMN_MAP.zone]),
        erpStatus: this.toStringOrNull(row[COLUMN_MAP.erpStatus]),
        abcClass: this.toStringOrNull(row[COLUMN_MAP.abcClass]),
        shelfLifeDays: this.toIntOrNull(row[COLUMN_MAP.shelfLife]),
        leadTimeDays: this.toIntOrNull(row[COLUMN_MAP.leadTime]),
        conditionalStatus: this.toStringOrNull(row[COLUMN_MAP.conditionalStatus]),
        challengeStatus: this.toStringOrNull(row[COLUMN_MAP.challengeStatus]),
        siteId,
        supplierId,
      },
    });

    if (item.createdAt.getTime() === item.updatedAt.getTime()) {
      stats.itemsCreated++;
    } else {
      stats.itemsUpdated++;
    }

    // 4. Create Inventory Snapshot
    const onHandQty = this.toIntOrNull(row[COLUMN_MAP.onHandQty]);
    if (onHandQty !== null) {
      await this.prisma.inventorySnapshot.create({
        data: {
          itemId: item.id,
          siteId,
          onHandQty,
          safetyStock: this.toIntOrNull(row[COLUMN_MAP.safetyStock]),
          onOrder: this.toIntOrNull(row[COLUMN_MAP.onOrder]),
          openSales: this.toIntOrNull(row[COLUMN_MAP.openSales]),
          openEstimates: this.toIntOrNull(row[COLUMN_MAP.openEstimates]),
          targetStock: this.toIntOrNull(row[COLUMN_MAP.targetStock]),
          preferredMax: this.toIntOrNull(row[COLUMN_MAP.preferredMax]),
          maxStock: this.toIntOrNull(row[COLUMN_MAP.maxStock]),
          weeksSupply: this.toDecimalOrNull(row[COLUMN_MAP.weeksSupply]),
          nextPoDate: this.toDateOrNull(row[COLUMN_MAP.nextPoDate]),
          nextPoQty: this.toIntOrNull(row[COLUMN_MAP.nextPoQty]),
          snapshotDate: importDate,
        },
      });
      stats.inventorySnapshotsCreated++;
    }

    // 5. Create/Update Sales Actuals
    const salesPeriods = [
      { value: row[COLUMN_MAP.monthMinus3], offset: -3, type: 'MONTH' },
      { value: row[COLUMN_MAP.monthMinus2], offset: -2, type: 'MONTH' },
      { value: row[COLUMN_MAP.lastMonth], offset: -1, type: 'MONTH' },
      { value: row[COLUMN_MAP.currentMonthSales], offset: 0, type: 'MONTH' },
    ];

    for (const period of salesPeriods) {
      const qty = this.toIntOrNull(period.value);
      if (qty !== null) {
        const periodDate = startOfMonth(subMonths(importDate, Math.abs(period.offset)));
        const periodLabel = format(periodDate, 'yyyy-MM');

        const salesResult = await this.prisma.salesActual.upsert({
          where: {
            itemId_siteId_periodType_periodLabel: {
              itemId: item.id,
              siteId,
              periodType: period.type,
              periodLabel,
            },
          },
          update: { quantity: qty, periodDate },
          create: {
            itemId: item.id,
            siteId,
            periodType: period.type,
            periodLabel,
            periodDate,
            quantity: qty,
          },
        });

        if (salesResult.createdAt.getTime() === salesResult.createdAt.getTime()) {
          stats.salesActualsCreated++;
        } else {
          stats.salesActualsUpdated++;
        }
      }
    }

    // 6. Create/Update Forecasts
    const forecastPeriods = [
      { value: row[COLUMN_MAP.currentMonthForecast], offset: 0 },
      { value: row[COLUMN_MAP.monthPlus1], offset: 1 },
      { value: row[COLUMN_MAP.monthPlus2], offset: 2 },
      { value: row[COLUMN_MAP.monthPlus3], offset: 3 },
      { value: row[COLUMN_MAP.monthPlus4], offset: 4 },
    ];

    // Get variance only for current month
    const variancePct = this.parseVariance(row[COLUMN_MAP.forecastVariance]);
    const supplyVariance = this.toIntOrNull(row[COLUMN_MAP.supplyVariance]);

    for (const period of forecastPeriods) {
      const qty = this.toIntOrNull(period.value);
      if (qty !== null) {
        const forecastMonth = startOfMonth(addMonths(importDate, period.offset));

        const forecastResult = await this.prisma.forecast.upsert({
          where: {
            itemId_siteId_forecastMonth: {
              itemId: item.id,
              siteId,
              forecastMonth,
            },
          },
          update: {
            predictedQty: qty,
            variancePct: period.offset === 0 ? variancePct : null,
            supplyVariance: period.offset === 0 ? supplyVariance : null,
          },
          create: {
            itemId: item.id,
            siteId,
            forecastMonth,
            predictedQty: qty,
            variancePct: period.offset === 0 ? variancePct : null,
            supplyVariance: period.offset === 0 ? supplyVariance : null,
          },
        });

        if (forecastResult.createdAt.getTime() === forecastResult.createdAt.getTime()) {
          stats.forecastsCreated++;
        } else {
          stats.forecastsUpdated++;
        }
      }
    }

    // 7. Create Customer Metric
    const totalCustomers = this.toIntOrNull(row[COLUMN_MAP.totalCustomers]);
    const topCustomers = this.toStringOrNull(row[COLUMN_MAP.topCustomers]);
    const buyer = this.toStringOrNull(row[COLUMN_MAP.buyer]);

    if (totalCustomers !== null || topCustomers || buyer) {
      await this.prisma.customerMetric.create({
        data: {
          itemId: item.id,
          totalCustomers,
          topCustomers,
          buyer,
          snapshotDate: importDate,
        },
      });
      stats.customerMetricsCreated++;
    }
  }

  // Helper methods for type conversion
  private toStringOrNull(value: unknown): string | null {
    if (value === null || value === undefined || value === '') return null;
    const str = String(value).trim();
    return str === '' ? null : str;
  }

  private toIntOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    return isNaN(num) ? null : Math.round(num);
  }

  private toDecimalOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    return isNaN(num) ? null : num;
  }

  private toDateOrNull(value: unknown): Date | null {
    if (value === null || value === undefined || value === '') return null;

    // Handle Excel date serial number
    if (typeof value === 'number') {
      // Excel date serial number conversion
      const date = new Date((value - 25569) * 86400 * 1000);
      return isNaN(date.getTime()) ? null : date;
    }

    // Handle string date (e.g., "2025/11/23")
    if (typeof value === 'string') {
      const date = new Date(value.replace(/\//g, '-'));
      return isNaN(date.getTime()) ? null : date;
    }

    return null;
  }

  private parseVariance(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const str = String(value).replace('%', '').trim();
    const num = Number(str);
    return isNaN(num) ? null : num;
  }

  async getImportHistory(limit = 50): Promise<ImportLogDto[]> {
    const logs = await this.prisma.importLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return logs.map((log) => this.toImportLogDto(log as ImportLogModel));
  }

  async getImportById(id: string): Promise<ImportLogDto | null> {
    const log = await this.prisma.importLog.findUnique({
      where: { id },
    });

    return log ? this.toImportLogDto(log as ImportLogModel) : null;
  }

  /**
   * Import data from an Excel file buffer with progress updates
   */
  async importFromBufferWithProgress(
    buffer: Buffer,
    fileName: string,
    importDate: Date,
    onProgress: ImportProgressCallback
  ): Promise<ImportResultDto> {
    // Create import log entry
    const importLog = await this.prisma.importLog.create({
      data: {
        fileName,
        importDate,
        status: ImportStatus.IN_PROGRESS,
      },
    });

    const stats: ImportStatsDto = {
      rowsProcessed: 0,
      sitesCreated: 0,
      sitesUpdated: 0,
      suppliersCreated: 0,
      suppliersUpdated: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      inventorySnapshotsCreated: 0,
      salesActualsCreated: 0,
      salesActualsUpdated: 0,
      forecastsCreated: 0,
      forecastsUpdated: 0,
      customerMetricsCreated: 0,
    };
    const errors: string[] = [];

    try {
      // Send validation phase progress
      onProgress({
        type: 'validation',
        phase: 'validating',
        current: 0,
        total: 100,
        percentage: 0,
        message: 'Parsing Excel file...',
      });

      // Parse Excel file
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error('Excel file contains no sheets');
      }
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        throw new Error('Failed to read sheet from Excel file');
      }
      const rows: SiqRow[] = XLSX.utils.sheet_to_json(sheet);

      // Validate required columns
      onProgress({
        type: 'validation',
        phase: 'validating',
        current: 50,
        total: 100,
        percentage: 50,
        message: 'Validating columns...',
      });

      if (rows.length > 0) {
        const firstRow = rows[0];
        if (firstRow) {
          const headers = Object.keys(firstRow);
          const validation = this.validateColumns(headers);
          if (!validation.valid) {
            throw new Error(`Missing required columns: ${validation.missing.join(', ')}`);
          }
        }
      }

      onProgress({
        type: 'validation',
        phase: 'validating',
        current: 100,
        total: 100,
        percentage: 100,
        message: `Validation complete. Found ${rows.length} rows to process.`,
      });

      // Cache for sites and suppliers to avoid repeated lookups
      const siteCache = new Map<string, string>(); // code -> id
      const supplierCache = new Map<string, string>(); // code -> id

      // Process rows with frequent progress updates
      const totalRows = rows.length;
      // Update progress every ~50 rows or at least 20 times for small files
      const progressInterval = Math.max(1, Math.min(50, Math.floor(totalRows / 20)));

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        try {
          await this.processRow(row, importDate, stats, siteCache, supplierCache);
          stats.rowsProcessed++;

          // Send progress update at intervals
          if (i % progressInterval === 0 || i === totalRows - 1) {
            onProgress({
              type: 'progress',
              phase: 'processing',
              current: i + 1,
              total: totalRows,
              percentage: Math.round(((i + 1) / totalRows) * 100),
              message: `Processing row ${i + 1} of ${totalRows}...`,
            });
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          errors.push(`Row ${i + 1}: ${errorMsg}`);
        }
      }

      // Send completion progress
      onProgress({
        type: 'progress',
        phase: 'processing',
        current: totalRows,
        total: totalRows,
        percentage: 100,
        message: `Processed all ${totalRows} rows. Finalizing...`,
      });

      // Update import log with success
      await this.prisma.importLog.update({
        where: { id: importLog.id },
        data: {
          status: ImportStatus.COMPLETED,
          rowsProcessed: stats.rowsProcessed,
          rowsCreated:
            stats.sitesCreated +
            stats.suppliersCreated +
            stats.itemsCreated +
            stats.inventorySnapshotsCreated +
            stats.salesActualsCreated +
            stats.forecastsCreated +
            stats.customerMetricsCreated,
          rowsUpdated:
            stats.sitesUpdated +
            stats.suppliersUpdated +
            stats.itemsUpdated +
            stats.salesActualsUpdated +
            stats.forecastsUpdated,
          rowsFailed: errors.length,
          errorLog: errors.length > 0 ? errors.slice(0, 100).join('\n') : null,
          completedAt: new Date(),
        },
      });

      return {
        importId: importLog.id,
        status: 'COMPLETED',
        stats,
        errors: errors.length > 0 ? errors.slice(0, 100) : undefined,
        completedAt: new Date().toISOString(),
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      // Send error progress
      onProgress({
        type: 'error',
        phase: 'complete',
        current: 0,
        total: 0,
        percentage: 0,
        message: errorMsg,
      });

      // Update import log with failure
      await this.prisma.importLog.update({
        where: { id: importLog.id },
        data: {
          status: ImportStatus.FAILED,
          rowsProcessed: stats.rowsProcessed,
          errorLog: errorMsg,
          completedAt: new Date(),
        },
      });

      return {
        importId: importLog.id,
        status: 'FAILED',
        stats,
        errors: [errorMsg],
        completedAt: new Date().toISOString(),
      };
    }
  }
}

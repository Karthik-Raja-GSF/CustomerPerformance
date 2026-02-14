import { injectable, inject } from "tsyringe";
import { PrismaClient, Prisma } from "@prisma/client";
import { IBidExportService } from "@/services/IBidExportService";
import {
  QueueBidExportDto,
  QueueBidExportByKeysDto,
  CancelBidExportByKeysDto,
  QueueBidExportResultDto,
  MarkExportedDto,
  MarkExportedResultDto,
  ExportResultDto,
  BidExportRunDto,
  QueueSummaryDto,
  BidExportProcessResultDto,
  BidExportType,
  BidExportRunStatus,
} from "@/contracts/dtos/bid-export.dto";
import { CustomerBidDto } from "@/contracts/dtos/customer-bid.dto";
import { createChildLogger } from "@/telemetry/logger";

const logger = createChildLogger("bid-export");

/**
 * Raw row returned by the queued bid data query
 */
interface QueuedBidRow {
  sourceDb: string | null;
  siteCode: string | null;
  customerName: string | null;
  customerBillTo: string | null;
  coOpCode: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  salesRep: string | null;
  itemNo: string;
  itemDescription: string | null;
  brandName: string | null;
  bidQty: Prisma.Decimal | null;
  bidStart: Date;
  bidEnd: Date | null;
  erpStatus: string | null;
  lastYearBidQty: Prisma.Decimal | null;
  lastYearActual: Prisma.Decimal | null;
  lyAugust: Prisma.Decimal | null;
  lySeptember: Prisma.Decimal | null;
  lyOctober: Prisma.Decimal | null;
  isLost: boolean | null;
  lastUpdatedAt: Date | null;
  lastUpdatedBy: string | null;
  confirmedAt: Date | null;
  confirmedBy: string | null;
  lastExportedAt: Date | null;
  lastExportedBy: string | null;
  yearAround: boolean | null;
  estimateJan: Prisma.Decimal | null;
  estimateFeb: Prisma.Decimal | null;
  estimateMar: Prisma.Decimal | null;
  estimateApr: Prisma.Decimal | null;
  estimateMay: Prisma.Decimal | null;
  estimateJun: Prisma.Decimal | null;
  estimateJul: Prisma.Decimal | null;
  estimateAug: Prisma.Decimal | null;
  estimateSep: Prisma.Decimal | null;
  estimateOct: Prisma.Decimal | null;
  estimateNov: Prisma.Decimal | null;
  estimateDec: Prisma.Decimal | null;
}

/**
 * Row returned when resolving filters to composite keys
 */
interface BidKeyRow {
  sourceDb: string;
  siteCode: string;
  customerBillTo: string;
  itemNo: string;
  schoolYear: string;
}

@injectable()
export class BidExportService implements IBidExportService {
  constructor(@inject("PrismaClient") private readonly prisma: PrismaClient) {}

  async queueExport(
    data: QueueBidExportDto,
    userEmail: string
  ): Promise<QueueBidExportResultDto> {
    const { exportType, schoolYear, filters } = data;

    logger.info(
      {
        event: "bid-export.queue.start",
        exportType,
        schoolYear,
        filters,
        userEmail,
      },
      "Queueing bid items for export"
    );

    // Resolve filters into matching bid composite keys
    const keys = await this.resolveFiltersToBidKeys(schoolYear, filters);

    if (keys.length === 0) {
      logger.info(
        { event: "bid-export.queue.empty", exportType, schoolYear },
        "No matching bid items found for queue"
      );
      return { itemsQueued: 0 };
    }

    // Batch insert QUEUED items
    const result = await this.prisma.customerBidExportItem.createMany({
      data: keys.map((key) => ({
        sourceDb: key.sourceDb,
        siteCode: key.siteCode,
        customerBillTo: key.customerBillTo,
        itemNo: key.itemNo,
        schoolYear: key.schoolYear,
        exportType: exportType as "CSV" | "SIQ",
        status: "QUEUED",
        queuedBy: userEmail,
      })),
    });

    logger.info(
      {
        event: "bid-export.queue.complete",
        exportType,
        itemsQueued: result.count,
        userEmail,
      },
      `Queued ${result.count} bid items for ${exportType} export`
    );

    return { itemsQueued: result.count };
  }

  async getQueuedBidData(exportType: BidExportType): Promise<CustomerBidDto[]> {
    // Join QUEUED export items with CustomerBidData + Customer + Item tables
    // to return full DTO shape for SIQ/CSV generation
    const rows = await this.prisma.$queryRaw<QueuedBidRow[]>(Prisma.sql`
      SELECT DISTINCT
          cbd.source_db AS "sourceDb",
          cbd.site_code AS "siteCode",
          c."name" AS "customerName",
          cbd.customer_bill_to AS "customerBillTo",
          c.co_op_code AS "coOpCode",
          c.contact AS "contactName",
          c.e_mail AS "contactEmail",
          c.phone_no_ AS "contactPhone",
          c.salesperson_code AS "salesRep",
          cbd.item_no AS "itemNo",
          i.description AS "itemDescription",
          i.description_2 AS "brandName",
          cbd.bid_qty AS "bidQty",
          cbd.bid_start AS "bidStart",
          cbd.bid_end AS "bidEnd",
          cbd.erp_status AS "erpStatus",
          cbd.last_year_bid_qty AS "lastYearBidQty",
          cbd.last_year_actual AS "lastYearActual",
          cbd.ly_august AS "lyAugust",
          cbd.ly_september AS "lySeptember",
          cbd.ly_october AS "lyOctober",
          cbd.is_lost AS "isLost",
          cbd.last_updated_at AS "lastUpdatedAt",
          cbd.last_updated_by AS "lastUpdatedBy",
          cbd.confirmed_at AS "confirmedAt",
          cbd.confirmed_by AS "confirmedBy",
          cbd.last_exported_at AS "lastExportedAt",
          cbd.last_exported_by AS "lastExportedBy",
          cbd.year_around AS "yearAround",
          cbd.estimate_jan AS "estimateJan",
          cbd.estimate_feb AS "estimateFeb",
          cbd.estimate_mar AS "estimateMar",
          cbd.estimate_apr AS "estimateApr",
          cbd.estimate_may AS "estimateMay",
          cbd.estimate_jun AS "estimateJun",
          cbd.estimate_jul AS "estimateJul",
          cbd.estimate_aug AS "estimateAug",
          cbd.estimate_sep AS "estimateSep",
          cbd.estimate_oct AS "estimateOct",
          cbd.estimate_nov AS "estimateNov",
          cbd.estimate_dec AS "estimateDec"
      FROM ait.customer_bid_export_item ei
      INNER JOIN ait.customer_bid_data cbd
          ON ei.source_db = cbd.source_db
          AND ei.site_code = cbd.site_code
          AND ei.customer_bill_to = cbd.customer_bill_to
          AND ei.item_no = cbd.item_no
          AND ei.school_year = cbd.school_year
      INNER JOIN dw2_nav.customer c
          ON cbd.customer_bill_to = c.no_
          AND cbd.source_db = c.source_db
      INNER JOIN dw2_nav.item i
          ON cbd.item_no = i.no_
          AND cbd.source_db = i.source_db
      WHERE ei.status = 'QUEUED'
        AND ei.export_type = ${exportType}::"ait"."BidExportType"
      ORDER BY cbd.site_code, cbd.item_no, cbd.customer_bill_to
    `);

    return rows.map((row) => this.mapRowToDto(row));
  }

  async markExported(
    data: MarkExportedDto,
    userEmail: string
  ): Promise<MarkExportedResultDto> {
    const { exportType } = data;
    const startTime = Date.now();

    logger.info(
      { event: "bid-export.mark.start", exportType, userEmail },
      "Marking queued items as exported"
    );

    // Use a transaction to atomically: create run, update items, update bid data
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create export run
      const run = await tx.customerBidExportRun.create({
        data: {
          exportType: exportType as "CSV" | "SIQ",
          triggeredBy: "manual",
          status: "IN_PROGRESS",
        },
      });

      // 2. Find all QUEUED items for this export type
      const queuedItems = await tx.customerBidExportItem.findMany({
        where: {
          status: "QUEUED",
          exportType: exportType as "CSV" | "SIQ",
        },
        select: {
          id: true,
          sourceDb: true,
          siteCode: true,
          customerBillTo: true,
          itemNo: true,
          schoolYear: true,
        },
      });

      if (queuedItems.length === 0) {
        // No items to export — mark run as completed with 0 records
        await tx.customerBidExportRun.update({
          where: { id: run.id },
          data: {
            status: "COMPLETED",
            totalRecords: 0,
            completedAt: new Date(),
            durationMs: Date.now() - startTime,
          },
        });
        return { runId: run.id, totalExported: 0 };
      }

      // 3. Update export items: QUEUED → EXPORTED, link to run
      await tx.customerBidExportItem.updateMany({
        where: {
          status: "QUEUED",
          exportType: exportType as "CSV" | "SIQ",
        },
        data: {
          status: "EXPORTED",
          runId: run.id,
        },
      });

      // 4. Update lastExportedAt/lastExportedBy on CustomerBidData
      // Build composite key conditions for batch update
      for (const item of queuedItems) {
        await tx.customerBidData.update({
          where: {
            sourceDb_siteCode_customerBillTo_itemNo_schoolYear: {
              sourceDb: item.sourceDb,
              siteCode: item.siteCode,
              customerBillTo: item.customerBillTo,
              itemNo: item.itemNo,
              schoolYear: item.schoolYear,
            },
          },
          data: {
            lastExportedAt: new Date(),
            lastExportedBy: userEmail,
          },
        });
      }

      // 5. Complete the run
      const durationMs = Date.now() - startTime;
      await tx.customerBidExportRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          totalRecords: queuedItems.length,
          completedAt: new Date(),
          durationMs,
        },
      });

      return { runId: run.id, totalExported: queuedItems.length };
    });

    logger.info(
      {
        event: "bid-export.mark.complete",
        runId: result.runId,
        totalExported: result.totalExported,
        durationMs: Date.now() - startTime,
      },
      `Marked ${result.totalExported} items as exported`
    );

    return result;
  }

  async getExportRuns(limit = 20): Promise<BidExportRunDto[]> {
    const runs = await this.prisma.customerBidExportRun.findMany({
      orderBy: { startedAt: "desc" },
      take: limit,
    });

    return runs.map((run) => ({
      id: run.id,
      status: run.status as BidExportRunStatus,
      exportType: run.exportType as BidExportType,
      triggeredBy: run.triggeredBy,
      totalRecords: run.totalRecords,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
      durationMs: run.durationMs,
      errorMessage: run.errorMessage,
    }));
  }

  async getQueueSummary(): Promise<QueueSummaryDto> {
    const counts = await this.prisma.customerBidExportItem.groupBy({
      by: ["exportType"],
      where: { status: "QUEUED" },
      _count: true,
    });

    const csv = counts.find((c) => c.exportType === "CSV")?._count ?? 0;
    const siq = counts.find((c) => c.exportType === "SIQ")?._count ?? 0;

    return { csv, siq, total: csv + siq };
  }

  async queueExportByKeys(
    data: QueueBidExportByKeysDto,
    userEmail: string
  ): Promise<QueueBidExportResultDto> {
    const { exportType, keys } = data;

    logger.info(
      {
        event: "bid-export.queue-by-keys.start",
        exportType,
        keyCount: keys.length,
        userEmail,
      },
      `Queueing ${keys.length} bid items by explicit keys`
    );

    if (keys.length === 0) {
      return { itemsQueued: 0 };
    }

    const result = await this.prisma.customerBidExportItem.createMany({
      data: keys.map((key) => ({
        sourceDb: key.sourceDb,
        siteCode: key.siteCode,
        customerBillTo: key.customerBillTo,
        itemNo: key.itemNo,
        schoolYear: key.schoolYear,
        exportType: exportType as "CSV" | "SIQ",
        status: "QUEUED",
        queuedBy: userEmail,
      })),
    });

    logger.info(
      {
        event: "bid-export.queue-by-keys.complete",
        exportType,
        itemsQueued: result.count,
        userEmail,
      },
      `Queued ${result.count} bid items for ${exportType} export`
    );

    return { itemsQueued: result.count };
  }

  async exportAndReturn(
    exportType: BidExportType,
    userEmail: string
  ): Promise<ExportResultDto> {
    const startTime = Date.now();

    logger.info(
      { event: "bid-export.export.start", exportType, userEmail },
      "Exporting queued items atomically"
    );

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Fetch full bid data for QUEUED items (same query as getQueuedBidData)
      const rows = await tx.$queryRaw<QueuedBidRow[]>(Prisma.sql`
        SELECT DISTINCT
            cbd.source_db AS "sourceDb",
            cbd.site_code AS "siteCode",
            c."name" AS "customerName",
            cbd.customer_bill_to AS "customerBillTo",
            c.co_op_code AS "coOpCode",
            c.contact AS "contactName",
            c.e_mail AS "contactEmail",
            c.phone_no_ AS "contactPhone",
            c.salesperson_code AS "salesRep",
            cbd.item_no AS "itemNo",
            i.description AS "itemDescription",
            i.description_2 AS "brandName",
            cbd.bid_qty AS "bidQty",
            cbd.bid_start AS "bidStart",
            cbd.bid_end AS "bidEnd",
            cbd.erp_status AS "erpStatus",
            cbd.last_year_bid_qty AS "lastYearBidQty",
            cbd.last_year_actual AS "lastYearActual",
            cbd.ly_august AS "lyAugust",
            cbd.ly_september AS "lySeptember",
            cbd.ly_october AS "lyOctober",
            cbd.is_lost AS "isLost",
            cbd.last_updated_at AS "lastUpdatedAt",
            cbd.last_updated_by AS "lastUpdatedBy",
            cbd.confirmed_at AS "confirmedAt",
            cbd.confirmed_by AS "confirmedBy",
            cbd.last_exported_at AS "lastExportedAt",
            cbd.last_exported_by AS "lastExportedBy",
            cbd.year_around AS "yearAround",
            cbd.estimate_jan AS "estimateJan",
            cbd.estimate_feb AS "estimateFeb",
            cbd.estimate_mar AS "estimateMar",
            cbd.estimate_apr AS "estimateApr",
            cbd.estimate_may AS "estimateMay",
            cbd.estimate_jun AS "estimateJun",
            cbd.estimate_jul AS "estimateJul",
            cbd.estimate_aug AS "estimateAug",
            cbd.estimate_sep AS "estimateSep",
            cbd.estimate_oct AS "estimateOct",
            cbd.estimate_nov AS "estimateNov",
            cbd.estimate_dec AS "estimateDec"
        FROM ait.customer_bid_export_item ei
        INNER JOIN ait.customer_bid_data cbd
            ON ei.source_db = cbd.source_db
            AND ei.site_code = cbd.site_code
            AND ei.customer_bill_to = cbd.customer_bill_to
            AND ei.item_no = cbd.item_no
            AND ei.school_year = cbd.school_year
        INNER JOIN dw2_nav.customer c
            ON cbd.customer_bill_to = c.no_
            AND cbd.source_db = c.source_db
        INNER JOIN dw2_nav.item i
            ON cbd.item_no = i.no_
            AND cbd.source_db = i.source_db
        WHERE ei.status = 'QUEUED'
          AND ei.export_type = ${exportType}::"ait"."BidExportType"
        ORDER BY cbd.site_code, cbd.item_no, cbd.customer_bill_to
      `);

      const bidData = rows.map((row) => this.mapRowToDto(row));

      if (rows.length === 0) {
        return { runId: "", totalExported: 0, data: [] as CustomerBidDto[] };
      }

      // 2. Create export run
      const run = await tx.customerBidExportRun.create({
        data: {
          exportType: exportType as "CSV" | "SIQ",
          triggeredBy: "manual",
          status: "IN_PROGRESS",
        },
      });

      // 3. Find QUEUED item PKs for lastExportedAt updates
      const queuedItems = await tx.customerBidExportItem.findMany({
        where: {
          status: "QUEUED",
          exportType: exportType as "CSV" | "SIQ",
        },
        select: {
          sourceDb: true,
          siteCode: true,
          customerBillTo: true,
          itemNo: true,
          schoolYear: true,
        },
      });

      // 4. Mark QUEUED → EXPORTED
      await tx.customerBidExportItem.updateMany({
        where: {
          status: "QUEUED",
          exportType: exportType as "CSV" | "SIQ",
        },
        data: {
          status: "EXPORTED",
          runId: run.id,
        },
      });

      // 5. Update lastExportedAt/lastExportedBy on CustomerBidData
      for (const item of queuedItems) {
        await tx.customerBidData.update({
          where: {
            sourceDb_siteCode_customerBillTo_itemNo_schoolYear: {
              sourceDb: item.sourceDb,
              siteCode: item.siteCode,
              customerBillTo: item.customerBillTo,
              itemNo: item.itemNo,
              schoolYear: item.schoolYear,
            },
          },
          data: {
            lastExportedAt: new Date(),
            lastExportedBy: userEmail,
          },
        });
      }

      // 6. Complete the run
      const durationMs = Date.now() - startTime;
      await tx.customerBidExportRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          totalRecords: queuedItems.length,
          completedAt: new Date(),
          durationMs,
        },
      });

      return {
        runId: run.id,
        totalExported: queuedItems.length,
        data: bidData,
      };
    });

    logger.info(
      {
        event: "bid-export.export.complete",
        runId: result.runId,
        totalExported: result.totalExported,
        durationMs: Date.now() - startTime,
      },
      `Exported ${result.totalExported} items atomically`
    );

    return result;
  }

  async cancelQueuedItems(exportType?: BidExportType): Promise<number> {
    const where: Prisma.CustomerBidExportItemWhereInput = {
      status: "QUEUED",
    };
    if (exportType) {
      where.exportType = exportType as "CSV" | "SIQ";
    }

    const result = await this.prisma.customerBidExportItem.updateMany({
      where,
      data: { status: "CANCELLED" },
    });

    logger.info(
      { event: "bid-export.cancel", exportType, cancelled: result.count },
      `Cancelled ${result.count} queued export items`
    );

    return result.count;
  }

  async cancelByKeys(data: CancelBidExportByKeysDto): Promise<number> {
    const { keys, exportType } = data;

    if (keys.length === 0) return 0;

    logger.info(
      {
        event: "bid-export.cancel-by-keys.start",
        exportType,
        keyCount: keys.length,
      },
      `Cancelling ${keys.length} queued export items by keys`
    );

    let totalCancelled = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const key of keys) {
        const where: Prisma.CustomerBidExportItemWhereInput = {
          sourceDb: key.sourceDb,
          siteCode: key.siteCode,
          customerBillTo: key.customerBillTo,
          itemNo: key.itemNo,
          schoolYear: key.schoolYear,
          status: "QUEUED",
        };
        if (exportType) {
          where.exportType = exportType as "CSV" | "SIQ";
        }
        const result = await tx.customerBidExportItem.updateMany({
          where,
          data: { status: "CANCELLED" },
        });
        totalCancelled += result.count;
      }
    });

    logger.info(
      {
        event: "bid-export.cancel-by-keys.complete",
        exportType,
        cancelled: totalCancelled,
      },
      `Cancelled ${totalCancelled} queued export items by keys`
    );

    return totalCancelled;
  }

  async clearExportByKeys(
    keys: Array<{
      sourceDb: string;
      siteCode: string;
      customerBillTo: string;
      itemNo: string;
      schoolYear: string;
    }>
  ): Promise<number> {
    if (keys.length === 0) return 0;

    logger.info(
      { event: "bid-export.clear-export.start", keyCount: keys.length },
      `Clearing export status on ${keys.length} bid records`
    );

    let totalCleared = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const key of keys) {
        await tx.customerBidData.update({
          where: {
            sourceDb_siteCode_customerBillTo_itemNo_schoolYear: {
              sourceDb: key.sourceDb,
              siteCode: key.siteCode,
              customerBillTo: key.customerBillTo,
              itemNo: key.itemNo,
              schoolYear: key.schoolYear,
            },
          },
          data: {
            lastExportedAt: null,
            lastExportedBy: null,
          },
        });
        totalCleared++;
      }
    });

    logger.info(
      { event: "bid-export.clear-export.complete", cleared: totalCleared },
      `Cleared export status on ${totalCleared} bid records`
    );

    return totalCleared;
  }

  async processPendingExports(): Promise<BidExportProcessResultDto> {
    // Infrastructure placeholder — the nightly push action (API/FTP) is TBD.
    // When enabled via BID_EXPORT_PROCESS_CRON, this method will be called
    // by the scheduler. Currently it just logs and returns without processing.
    logger.info(
      { event: "bid-export.process.noop" },
      "Bid export processing called but push method is not yet configured — no action taken"
    );

    return { runsCreated: 0, totalProcessed: 0, failed: 0 };
  }

  /**
   * Resolve filter criteria to matching bid composite keys.
   * Uses the same WHERE clause logic as CustomerBidService.getCustomerBids
   * but only SELECTs the 5 PK columns.
   */
  private async resolveFiltersToBidKeys(
    schoolYear: string,
    filters: Record<string, unknown>
  ): Promise<BidKeyRow[]> {
    const whereConditions: Prisma.Sql[] = [];

    if (filters.siteCode) {
      whereConditions.push(
        Prisma.sql`cbd.site_code = ${String(filters.siteCode)}`
      );
    }
    if (filters.customerBillTo) {
      whereConditions.push(
        Prisma.sql`cbd.customer_bill_to ILIKE ${"%" + String(filters.customerBillTo) + "%"}`
      );
    }
    if (filters.customerName) {
      whereConditions.push(
        Prisma.sql`c."name" ILIKE ${"%" + String(filters.customerName) + "%"}`
      );
    }
    if (filters.salesRep) {
      whereConditions.push(
        Prisma.sql`c.salesperson_code = ${String(filters.salesRep)}`
      );
    }
    if (filters.itemCode) {
      whereConditions.push(
        Prisma.sql`cbd.item_no = ${String(filters.itemCode)}`
      );
    }
    if (filters.erpStatus) {
      whereConditions.push(
        Prisma.sql`cbd.erp_status ILIKE ${"%" + String(filters.erpStatus) + "%"}`
      );
    }
    if (filters.sourceDb) {
      whereConditions.push(
        Prisma.sql`cbd.source_db = ${String(filters.sourceDb)}`
      );
    }
    if (filters.coOpCode) {
      whereConditions.push(
        Prisma.sql`c.co_op_code = ${String(filters.coOpCode)}`
      );
    }
    if (filters.isLost !== undefined) {
      whereConditions.push(
        Prisma.sql`cbd.is_lost = ${Boolean(filters.isLost)}`
      );
    }
    if (filters.isLost !== true) {
      whereConditions.push(
        Prisma.sql`cbd.bid_start IS NOT NULL AND cbd.bid_end IS NOT NULL`
      );
    }
    if (filters.confirmed !== undefined) {
      if (filters.confirmed) {
        whereConditions.push(Prisma.sql`cbd.confirmed_at IS NOT NULL`);
      } else {
        whereConditions.push(Prisma.sql`cbd.confirmed_at IS NULL`);
      }
    }
    if (filters.exported !== undefined) {
      if (filters.exported) {
        whereConditions.push(Prisma.sql`cbd.last_exported_at IS NOT NULL`);
      } else {
        whereConditions.push(Prisma.sql`cbd.last_exported_at IS NULL`);
      }
    }

    const additionalWhere =
      whereConditions.length > 0
        ? Prisma.sql`AND ${Prisma.join(whereConditions, " AND ")}`
        : Prisma.empty;

    return this.prisma.$queryRaw<BidKeyRow[]>(Prisma.sql`
      SELECT
          cbd.source_db AS "sourceDb",
          cbd.site_code AS "siteCode",
          cbd.customer_bill_to AS "customerBillTo",
          cbd.item_no AS "itemNo",
          cbd.school_year AS "schoolYear"
      FROM ait.customer_bid_data cbd
      INNER JOIN dw2_nav.customer c
          ON cbd.customer_bill_to = c.no_
          AND cbd.source_db = c.source_db
      WHERE cbd.school_year = ${schoolYear}
        ${additionalWhere}
    `);
  }

  /**
   * Map a raw query row to CustomerBidDto
   */
  private mapRowToDto(row: QueuedBidRow): CustomerBidDto {
    return {
      sourceDb: row.sourceDb,
      siteCode: row.siteCode,
      customerName: row.customerName,
      customerBillTo: row.customerBillTo,
      coOpCode: row.coOpCode,
      contactName: row.contactName,
      contactEmail: row.contactEmail,
      contactPhone: row.contactPhone,
      salesRep: row.salesRep,
      bidStartDate: row.bidStart?.toISOString() ?? "",
      bidEndDate: row.bidEnd?.toISOString() ?? null,
      itemCode: row.itemNo,
      itemDescription: row.itemDescription,
      brandName: row.brandName,
      erpStatus: row.erpStatus,
      bidQuantity: row.bidQty ? Number(row.bidQty) : null,
      lastYearBidQty: row.lastYearBidQty ? Number(row.lastYearBidQty) : null,
      lastYearActual: row.lastYearActual ? Number(row.lastYearActual) : null,
      lyAugust: row.lyAugust ? Number(row.lyAugust) : null,
      lySeptember: row.lySeptember ? Number(row.lySeptember) : null,
      lyOctober: row.lyOctober ? Number(row.lyOctober) : null,
      isLost: row.isLost ?? false,
      lastUpdatedAt: row.lastUpdatedAt?.toISOString() ?? null,
      lastUpdatedBy: row.lastUpdatedBy ?? null,
      confirmedAt: row.confirmedAt?.toISOString() ?? null,
      confirmedBy: row.confirmedBy ?? null,
      lastExportedAt: row.lastExportedAt?.toISOString() ?? null,
      lastExportedBy: row.lastExportedBy ?? null,
      yearAround: row.yearAround ?? false,
      estimateJan: row.estimateJan ? Number(row.estimateJan) : null,
      estimateFeb: row.estimateFeb ? Number(row.estimateFeb) : null,
      estimateMar: row.estimateMar ? Number(row.estimateMar) : null,
      estimateApr: row.estimateApr ? Number(row.estimateApr) : null,
      estimateMay: row.estimateMay ? Number(row.estimateMay) : null,
      estimateJun: row.estimateJun ? Number(row.estimateJun) : null,
      estimateJul: row.estimateJul ? Number(row.estimateJul) : null,
      estimateAug: row.estimateAug ? Number(row.estimateAug) : null,
      estimateSep: row.estimateSep ? Number(row.estimateSep) : null,
      estimateOct: row.estimateOct ? Number(row.estimateOct) : null,
      estimateNov: row.estimateNov ? Number(row.estimateNov) : null,
      estimateDec: row.estimateDec ? Number(row.estimateDec) : null,
    };
  }
}

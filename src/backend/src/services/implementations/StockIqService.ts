import { injectable, inject } from "tsyringe";
import { PrismaClient, Prisma } from "@prisma/client";
import { config } from "@/config/index";
import { IStockIqService } from "@/services/IStockIqService";
import {
  SyncResultDto,
  SyncLogDto,
  OrphanedRecordDto,
  DeleteOrphansResultDto,
  StockIqApiResponseItem,
} from "@/contracts/dtos/stockiq.dto";
import {
  StockIqApiError,
  StockIqAuthError,
  StockIqConfigError,
  StockIqSyncInProgressError,
} from "@/utils/errors/stockiq-errors";
import { createChildLogger } from "@/telemetry/logger";

const logger = createChildLogger("stockiq");

/**
 * StockIQ Service Implementation
 *
 * Handles syncing report data from StockIQ Custom Report API.
 * Uses upsert pattern with sync_id tracking.
 */
@injectable()
export class StockIqService implements IStockIqService {
  constructor(@inject("PrismaClient") private readonly prisma: PrismaClient) {}

  /**
   * Trigger an upsert sync from StockIQ API
   */
  async upsertSync(
    triggeredBy: "scheduled" | "manual"
  ): Promise<SyncResultDto> {
    const syncId = crypto.randomUUID();
    const startTime = Date.now();

    logger.info(
      { event: "stockiq.sync.start", syncId, triggeredBy },
      "Starting StockIQ sync"
    );

    // Check if there's already a recent sync in progress
    // Only block if the IN_PROGRESS sync started within the last 2 hours
    // Older syncs are considered stale (process might have crashed)
    const staleThresholdMs = 2 * 60 * 60 * 1000; // 2 hours
    const inProgress = await this.prisma.siqSyncLog.findFirst({
      where: {
        status: "IN_PROGRESS",
        startedAt: { gte: new Date(Date.now() - staleThresholdMs) },
      },
    });

    if (inProgress) {
      throw new StockIqSyncInProgressError();
    }

    // Create sync log entry
    await this.prisma.siqSyncLog.create({
      data: {
        id: syncId,
        status: "IN_PROGRESS",
        triggeredBy,
      },
    });

    try {
      // Fetch from StockIQ API
      const apiStartTime = Date.now();
      const { data: apiRecords, status: apiStatus } = await this.fetchFromApi();
      const apiResponseTimeMs = Date.now() - apiStartTime;

      logger.info(
        {
          event: "stockiq.api.success",
          syncId,
          recordCount: apiRecords.length,
          apiResponseTimeMs,
        },
        "Fetched records from StockIQ API"
      );

      // Get existing keys to determine insert vs update
      const existingRecords = await this.prisma.siqReportData.findMany({
        select: { siteCode: true, itemCode: true },
      });
      const existingKeys = new Set(
        existingRecords.map((r) => `${r.siteCode}|${r.itemCode}`)
      );

      let recordsInserted = 0;
      let recordsUpdated = 0;

      // Upsert all records in batches
      const batchSize = 100;
      for (let i = 0; i < apiRecords.length; i += batchSize) {
        const batch = apiRecords.slice(i, i + batchSize);

        await this.prisma.$transaction(
          batch.map((record) => {
            const key = `${record.SiteCode}|${record.ItemCode}`;
            const isNew = !existingKeys.has(key);
            const data = this.transformRecord(record, syncId);

            if (isNew) recordsInserted++;
            else recordsUpdated++;

            return this.prisma.siqReportData.upsert({
              where: {
                siteCode_itemCode: {
                  siteCode: record.SiteCode,
                  itemCode: record.ItemCode,
                },
              },
              create: data,
              update: data,
            });
          })
        );
      }

      const durationMs = Date.now() - startTime;

      // Update sync log with success
      await this.prisma.siqSyncLog.update({
        where: { id: syncId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          recordsTotal: apiRecords.length,
          recordsInserted,
          recordsUpdated,
          apiResponseStatus: apiStatus,
          apiResponseTimeMs,
          durationMs,
        },
      });

      logger.info(
        {
          event: "stockiq.sync.complete",
          syncId,
          recordsTotal: apiRecords.length,
          recordsInserted,
          recordsUpdated,
          durationMs,
        },
        "StockIQ sync completed successfully"
      );

      return {
        syncId,
        status: "COMPLETED",
        recordsTotal: apiRecords.length,
        recordsInserted,
        recordsUpdated,
        durationMs,
        apiResponseStatus: apiStatus,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Update sync log with failure
      await this.prisma.siqSyncLog.update({
        where: { id: syncId },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorMessage,
          durationMs,
          ...(error instanceof StockIqApiError && {
            apiResponseStatus: error.apiStatusCode,
            apiErrorMessage: error.apiErrorMessage,
          }),
        },
      });

      logger.error(
        {
          event: "stockiq.sync.failed",
          syncId,
          error: errorMessage,
          durationMs,
        },
        "StockIQ sync failed"
      );

      throw error;
    }
  }

  /**
   * Get sync history
   */
  async getSyncHistory(limit = 20): Promise<SyncLogDto[]> {
    const logs = await this.prisma.siqSyncLog.findMany({
      orderBy: { startedAt: "desc" },
      take: limit,
    });

    return logs.map((log) => this.toSyncLogDto(log));
  }

  /**
   * Get the latest sync status
   */
  async getLatestSyncStatus(): Promise<SyncLogDto | null> {
    const log = await this.prisma.siqSyncLog.findFirst({
      orderBy: { startedAt: "desc" },
    });

    return log ? this.toSyncLogDto(log) : null;
  }

  /**
   * Get orphaned records (in DB but not in API)
   */
  async getOrphanedRecords(): Promise<OrphanedRecordDto[]> {
    // Fetch current API records
    const { data: apiRecords } = await this.fetchFromApi();
    const apiKeys = new Set(
      apiRecords.map((r) => `${r.SiteCode}|${r.ItemCode}`)
    );

    // Get all DB records
    const dbRecords = await this.prisma.siqReportData.findMany({
      select: { siteCode: true, itemCode: true, syncedAt: true },
    });

    // Find orphaned records
    return dbRecords
      .filter((r) => !apiKeys.has(`${r.siteCode}|${r.itemCode}`))
      .map((r) => ({
        siteCode: r.siteCode,
        itemCode: r.itemCode,
        syncedAt: r.syncedAt.toISOString(),
      }));
  }

  /**
   * Delete orphaned records
   */
  async deleteOrphanedRecords(): Promise<DeleteOrphansResultDto> {
    const orphans = await this.getOrphanedRecords();

    if (orphans.length === 0) {
      return {
        deletedCount: 0,
        deletedAt: new Date().toISOString(),
      };
    }

    // Delete orphaned records
    await this.prisma.siqReportData.deleteMany({
      where: {
        OR: orphans.map((o) => ({
          siteCode: o.siteCode,
          itemCode: o.itemCode,
        })),
      },
    });

    // Update the latest sync log with deleted count
    const latestSync = await this.prisma.siqSyncLog.findFirst({
      orderBy: { startedAt: "desc" },
    });

    if (latestSync) {
      await this.prisma.siqSyncLog.update({
        where: { id: latestSync.id },
        data: {
          recordsDeleted: orphans.length,
        },
      });
    }

    logger.info(
      { event: "stockiq.orphans.deleted", count: orphans.length },
      "Deleted orphaned records"
    );

    return {
      deletedCount: orphans.length,
      deletedAt: new Date().toISOString(),
    };
  }

  /**
   * Fetch data from StockIQ API with Basic Auth
   */
  private async fetchFromApi(): Promise<{
    data: StockIqApiResponseItem[];
    status: number;
  }> {
    const { baseUrl, customReportId, username, password, timeoutMs } =
      config.stockiq;

    if (!username || !password) {
      throw new StockIqConfigError("StockIQ credentials are not configured");
    }

    const url = `${baseUrl}/api/CustomReportProducer?customReportId=${customReportId}`;
    const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

    logger.debug(
      { event: "stockiq.api.request", url },
      "Fetching from StockIQ API"
    );

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.status === 401) {
      throw new StockIqAuthError();
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new StockIqApiError(
        `StockIQ API returned ${response.status}`,
        response.status,
        errorText
      );
    }

    const data = (await response.json()) as StockIqApiResponseItem[];
    return { data, status: response.status };
  }

  /**
   * Transform API response item to database record
   */
  private transformRecord(
    item: StockIqApiResponseItem,
    syncId: string
  ): Prisma.SiqReportDataCreateInput {
    return {
      siteCode: item.SiteCode,
      itemCode: item.ItemCode,
      abcClass: item["ABC Class"] || null,
      safetyStock: this.toDecimal(item["Safety Stock"]),
      targetStock: this.toDecimal(item["Target Stock"]),
      preferredMax: this.toDecimal(item["Preferred Max"]),
      maxStock: this.toDecimal(item["Max Stock"]),
      openEstimates: this.toDecimal(item["Open Estimates"]),
      openSalesPlusEstimates: this.toDecimal(
        item["Open Sales + Open Estimates"]
      ),
      currentMonthForecast: this.toDecimal(item["Current Month Forecast"]),
      forecastMonth1: this.toDecimal(item["Month +1 Forecast"]),
      forecastMonth2: this.toDecimal(item["Month +2 Forecast"]),
      forecastMonth3: this.toDecimal(item["Month +3 Forecast"]),
      forecastMonth4: this.toDecimal(item["Month +4 Forecast"]),
      weeksSupplyOnhand: this.parseDecimalString(item["Weeks Supply Onhand"]),
      weeksOnhandEst: this.parseDecimalString(item["Weeks OnHand Est"]),
      forecastVarianceMtd: this.parsePercentage(item["Forecast Variance MTD"]),
      supplyVariance: this.toDecimal(item["Supply Variance"]),
      totalCustomers: item["Total Customers"] ?? null,
      top5CustomerShipTos: item["Top 5 Customer Ship-To's"] || null,
      syncLog: { connect: { id: syncId } },
    };
  }

  /**
   * Convert number to Decimal or null
   */
  private toDecimal(value: number | null | undefined): Prisma.Decimal | null {
    if (value === null || value === undefined) return null;
    return new Prisma.Decimal(value);
  }

  /**
   * Parse string to Decimal (e.g., "4.8" -> 4.8)
   */
  private parseDecimalString(
    value: string | null | undefined
  ): Prisma.Decimal | null {
    if (!value) return null;
    const parsed = parseFloat(value);
    if (isNaN(parsed)) return null;
    return new Prisma.Decimal(parsed);
  }

  /**
   * Parse percentage string to Decimal (e.g., "59.7%" -> 59.7)
   */
  private parsePercentage(
    value: string | null | undefined
  ): Prisma.Decimal | null {
    if (!value) return null;
    const cleaned = value.replace("%", "").trim();
    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) return null;
    return new Prisma.Decimal(parsed);
  }

  /**
   * Map sync log to DTO
   */
  private toSyncLogDto(log: {
    id: string;
    status: string;
    startedAt: Date;
    completedAt: Date | null;
    recordsTotal: number | null;
    recordsInserted: number | null;
    recordsUpdated: number | null;
    recordsDeleted: number | null;
    apiResponseStatus: number | null;
    apiResponseTimeMs: number | null;
    apiErrorMessage: string | null;
    errorMessage: string | null;
    durationMs: number | null;
    triggeredBy: string;
  }): SyncLogDto {
    return {
      id: log.id,
      status: log.status,
      startedAt: log.startedAt.toISOString(),
      completedAt: log.completedAt?.toISOString() ?? null,
      recordsTotal: log.recordsTotal,
      recordsInserted: log.recordsInserted,
      recordsUpdated: log.recordsUpdated,
      recordsDeleted: log.recordsDeleted,
      apiResponseStatus: log.apiResponseStatus,
      apiResponseTimeMs: log.apiResponseTimeMs,
      apiErrorMessage: log.apiErrorMessage,
      errorMessage: log.errorMessage,
      durationMs: log.durationMs,
      triggeredBy: log.triggeredBy,
    };
  }
}

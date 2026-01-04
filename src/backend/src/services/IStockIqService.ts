import {
  SyncResultDto,
  SyncLogDto,
  OrphanedRecordDto,
  DeleteOrphansResultDto,
} from "@/contracts/dtos/stockiq.dto";

/**
 * StockIQ Service Interface
 *
 * Defines the contract for StockIQ API integration services.
 * Handles syncing report data from StockIQ Custom Report API.
 */
export const STOCKIQ_SERVICE_TOKEN = Symbol.for("IStockIqService");

export interface IStockIqService {
  /**
   * Trigger an upsert sync from StockIQ API
   * Inserts new records and updates existing ones (no deletes)
   * @param triggeredBy - Who/what triggered the sync ('scheduled' | 'manual')
   * @returns Promise resolving to sync result with counts
   */
  upsertSync(triggeredBy: "scheduled" | "manual"): Promise<SyncResultDto>;

  /**
   * Get sync history
   * @param limit - Maximum number of records to return (default 20)
   * @returns Promise resolving to array of sync log DTOs
   */
  getSyncHistory(limit?: number): Promise<SyncLogDto[]>;

  /**
   * Get the latest sync status
   * @returns Promise resolving to the latest sync log DTO or null
   */
  getLatestSyncStatus(): Promise<SyncLogDto | null>;

  /**
   * Get orphaned records (in DB but not in API)
   * @returns Promise resolving to array of orphaned record identifiers
   */
  getOrphanedRecords(): Promise<OrphanedRecordDto[]>;

  /**
   * Delete orphaned records
   * @returns Promise resolving to delete result with count
   */
  deleteOrphanedRecords(): Promise<DeleteOrphansResultDto>;
}

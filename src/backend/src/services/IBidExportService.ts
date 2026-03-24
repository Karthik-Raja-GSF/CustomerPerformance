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
  WebhookExportResultDto,
  WebhookCompleteResultDto,
} from "@/contracts/dtos/bid-export.dto";
import { CustomerBidDto } from "@/contracts/dtos/customer-bid.dto";

/**
 * Bid Export Service Interface
 *
 * Manages the export queue for customer bid data.
 * Users queue items for export, then trigger exports manually.
 * A nightly scheduler can also process pending exports (when enabled).
 */
export const BID_EXPORT_SERVICE_TOKEN = Symbol.for("IBidExportService");

export interface IBidExportService {
  /**
   * Queue bid items for export based on filter criteria.
   * Resolves filters to matching bid records and creates QUEUED entries.
   */
  queueExport(
    data: QueueBidExportDto,
    userEmail: string
  ): Promise<QueueBidExportResultDto>;

  /**
   * Get full CustomerBidDto data for all QUEUED items of a given export type.
   * Used by the frontend to generate NAV/WH files.
   */
  getQueuedBidData(exportType: BidExportType): Promise<CustomerBidDto[]>;

  /**
   * Mark all QUEUED items of a given export type as EXPORTED.
   * Creates an export run log and updates lastExportedAt/lastExportedBy on CustomerBidData.
   */
  markExported(
    data: MarkExportedDto,
    userEmail: string
  ): Promise<MarkExportedResultDto>;

  /**
   * Get export run history (most recent first).
   */
  getExportRuns(limit?: number): Promise<BidExportRunDto[]>;

  /**
   * Get queue summary — count of QUEUED items by export type.
   */
  getQueueSummary(): Promise<QueueSummaryDto>;

  /**
   * Queue bid items for export using explicit composite keys.
   * Directly inserts QUEUED entries without filter resolution.
   */
  queueExportByKeys(
    data: QueueBidExportByKeysDto,
    userEmail: string
  ): Promise<QueueBidExportResultDto>;

  /**
   * Atomically mark QUEUED items as EXPORTED and return their full bid data.
   * Combines getQueuedBidData + markExported in a single transaction.
   */
  exportAndReturn(
    exportType: BidExportType,
    userEmail: string
  ): Promise<ExportResultDto>;

  /**
   * Cancel all QUEUED items, optionally filtered by export type.
   */
  cancelQueuedItems(exportType?: BidExportType): Promise<number>;

  /**
   * Cancel QUEUED items by explicit composite keys.
   */
  cancelByKeys(data: CancelBidExportByKeysDto): Promise<number>;

  /**
   * Clear export tracking (last_exported_at/by) on customer_bid_data for given keys.
   * Does NOT modify customer_bid_export_item records (preserves audit trail).
   */
  clearExportByKeys(
    keys: Array<{
      sourceDb: string;
      siteCode: string;
      customerBillTo: string;
      itemNo: string;
      schoolYear: string;
    }>
  ): Promise<number>;

  /**
   * Process pending exports — scheduler entry point.
   * Infrastructure method for future nightly push (API/FTP).
   * Currently a no-op placeholder that logs and returns.
   */
  processPendingExports(): Promise<BidExportProcessResultDto>;

  /**
   * Prepare a webhook export — find all QUEUED NAV items, create an IN_PROGRESS run,
   * and return bid data in webhook format.
   * Idempotent: if an IN_PROGRESS NAV run already exists, returns that same run.
   */
  prepareWebhookExport(userEmail: string): Promise<WebhookExportResultDto>;

  /**
   * Complete a webhook export — mark the run's items as EXPORTED and the run as COMPLETED.
   * Called by the external system after successfully processing the data.
   */
  completeWebhookExport(
    runId: string,
    userEmail: string
  ): Promise<WebhookCompleteResultDto>;
}

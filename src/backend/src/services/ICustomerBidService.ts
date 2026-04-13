import {
  CustomerBidQueryDto,
  CustomerBidListResponseDto,
  CustomerBidKeyDto,
  UpdateCustomerBidDto,
  BulkUpdateCustomerBidDto,
  BulkUpdateResultDto,
  BulkUpdatePreviewResultDto,
  CustomerBidDto,
  CustomerBidFilterOptionsDto,
  CustomerBidStatsDto,
  SyncResultDto,
  SyncLogDto,
  SchoolYear,
} from "@/contracts/dtos/customer-bid.dto";

/**
 * Customer Bid Service Interface
 *
 * Defines the contract for customer bid data retrieval from NAV database.
 * Handles querying bid/pricing data with calculated WON/LOST status
 * based on school year periods.
 */
export const CUSTOMER_BID_SERVICE_TOKEN = Symbol.for("ICustomerBidService");

export interface ICustomerBidService {
  /**
   * Get paginated customer bid records
   *
   * @param query - Query parameters for filtering and pagination
   * @returns Promise resolving to paginated customer bid list
   */
  getCustomerBids(
    query: CustomerBidQueryDto
  ): Promise<CustomerBidListResponseDto>;

  /**
   * Update user-editable fields on a customer bid record
   *
   * @param key - Composite key identifying the record
   * @param data - User-editable fields to update
   * @returns Promise resolving to updated customer bid DTO
   */
  updateBid(
    key: CustomerBidKeyDto,
    data: UpdateCustomerBidDto,
    userEmail: string,
    userGroups: string[]
  ): Promise<CustomerBidDto>;

  /**
   * Bulk update user-editable fields on multiple customer bid records
   *
   * @param data - Bulk update payload with records to update
   * @returns Promise resolving to bulk update result
   */
  bulkUpdateBids(
    data: BulkUpdateCustomerBidDto,
    userEmail: string
  ): Promise<BulkUpdateResultDto>;

  /**
   * Preview which records in a bulk update payload would actually change
   *
   * @param data - Bulk update payload to preview
   * @returns Promise resolving to preview result with changed/unchanged counts and keys
   */
  previewBulkUpdate(
    data: BulkUpdateCustomerBidDto
  ): Promise<BulkUpdatePreviewResultDto>;

  /**
   * Confirm a customer bid record
   *
   * @param key - Composite key identifying the record
   * @param userEmail - Email of user confirming (from JWT)
   * @returns Promise resolving to updated customer bid DTO
   */
  confirmBid(
    key: CustomerBidKeyDto,
    userEmail: string
  ): Promise<CustomerBidDto>;

  /**
   * Unconfirm a customer bid record
   *
   * @param key - Composite key identifying the record
   * @returns Promise resolving to updated customer bid DTO
   */
  unconfirmBid(key: CustomerBidKeyDto): Promise<CustomerBidDto>;

  /**
   * Trigger a sync operation to populate/refresh calculated fields
   *
   * @param schoolYear - School year to sync (next, current, previous)
   * @param triggeredBy - How the sync was triggered
   * @returns Promise resolving to sync result
   */
  sync(
    schoolYear: SchoolYear,
    triggeredBy: "manual" | "scheduled"
  ): Promise<SyncResultDto>;

  /**
   * Get the latest sync status
   *
   * @returns Promise resolving to latest sync log entry or null
   */
  getSyncStatus(): Promise<SyncLogDto | null>;

  /**
   * Get sync history
   *
   * @param limit - Maximum number of entries to return
   * @returns Promise resolving to array of sync log entries
   */
  getSyncHistory(limit?: number): Promise<SyncLogDto[]>;

  /**
   * Get aggregate statistics for customer bids matching the given filters
   *
   * @param query - Query parameters for filtering (pagination ignored)
   * @returns Promise resolving to stats with totals and per-location breakdown
   */
  getStats(query: CustomerBidQueryDto): Promise<CustomerBidStatsDto>;

  /**
   * Get distinct filter option values for autocomplete suggestions
   *
   * @returns Promise resolving to distinct values for each filterable field
   */
  getFilterOptions(): Promise<CustomerBidFilterOptionsDto>;

  /**
   * Stream all customer bids matching filters for bulk export via SSE.
   * Uses a COUNT check + fast path for small results, or a Postgres cursor for large ones.
   */
  streamCustomerBidsForExport(
    query: CustomerBidQueryDto,
    onBatch: (
      dtos: CustomerBidDto[],
      meta: {
        batch: number;
        rowsSoFar: number;
        total: number;
        truncated: boolean;
      }
    ) => void,
    maxRows?: number
  ): Promise<{
    totalRows: number;
    totalMatching: number;
    truncated: boolean;
  }>;
}

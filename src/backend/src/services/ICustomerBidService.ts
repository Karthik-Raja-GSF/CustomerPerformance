import {
  CustomerBidQueryDto,
  CustomerBidListResponseDto,
  CustomerBidKeyDto,
  UpdateCustomerBidDto,
  BulkUpdateCustomerBidDto,
  BulkUpdateResultDto,
  CustomerBidDto,
  CustomerBidFilterOptionsDto,
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
   * @param userId - ID of user making the update (for audit)
   * @returns Promise resolving to updated customer bid DTO
   */
  updateBid(
    key: CustomerBidKeyDto,
    data: UpdateCustomerBidDto,
    userId: string
  ): Promise<CustomerBidDto>;

  /**
   * Bulk update user-editable fields on multiple customer bid records
   *
   * @param data - Bulk update payload with records to update
   * @param userId - ID of user making the update (for audit)
   * @returns Promise resolving to bulk update result
   */
  bulkUpdateBids(
    data: BulkUpdateCustomerBidDto,
    userId: string
  ): Promise<BulkUpdateResultDto>;

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
   * Get distinct filter option values for autocomplete suggestions
   *
   * @returns Promise resolving to distinct values for each filterable field
   */
  getFilterOptions(): Promise<CustomerBidFilterOptionsDto>;
}

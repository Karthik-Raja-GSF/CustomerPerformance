import {
  CustomerBidQueryDto,
  CustomerBidListResponseDto,
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
}

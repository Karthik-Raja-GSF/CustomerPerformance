/**
 * Customer Bids Types - Frontend type definitions for Customer Bids feature
 */

/**
 * Single customer bid record
 */
export interface CustomerBidDto {
  siteCode: string | null;
  customerName: string | null;
  customerBillTo: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  salesRep: string | null;
  wonLost: "WON" | "LOST";
  /** ISO8601 UTC timestamp */
  bidStartDate: string;
  /** ISO8601 UTC timestamp */
  bidEndDate: string | null;
  itemCode: string;
  itemDescription: string | null;
  erpStatus: string | null;
  bidQuantity: number | null;
  lastYearBidQty: number | null;
}

/**
 * Pagination metadata
 * Uses hasMore pattern for performance (avoids expensive count queries)
 */
export interface PaginationDto {
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Query parameters for customer bids endpoint
 */
export interface CustomerBidFilters {
  page?: number;
  limit?: number;
  siteCode?: string;
  customerNo?: string;
  salesRep?: string;
  itemCode?: string;
}

/**
 * API response for customer bids list
 */
export interface CustomerBidListResponse {
  data: CustomerBidDto[];
  pagination: PaginationDto;
}

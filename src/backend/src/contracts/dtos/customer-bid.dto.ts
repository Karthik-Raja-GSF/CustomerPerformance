/**
 * Customer Bid DTOs - Data Transfer Objects for Customer Bids API
 */

/**
 * Single customer bid record DTO
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
 * Pagination metadata DTO
 * Uses hasMore pattern instead of total/totalPages for performance
 * (avoids expensive COUNT queries on large datasets)
 */
export interface PaginationDto {
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Paginated customer bid list response DTO
 */
export interface CustomerBidListResponseDto {
  data: CustomerBidDto[];
  pagination: PaginationDto;
}

/**
 * Query parameters for customer bids endpoint
 */
export interface CustomerBidQueryDto {
  page?: number;
  limit?: number;
  siteCode?: string;
  customerNo?: string;
  salesRep?: string;
  itemCode?: string;
  sourceDb?: string;
  wonLost?: "WON" | "LOST";
}

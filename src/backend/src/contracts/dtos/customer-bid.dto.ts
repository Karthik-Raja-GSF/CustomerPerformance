/**
 * Customer Bid DTOs - Data Transfer Objects for Customer Bids API
 */

/**
 * School year filter options
 */
export type SchoolYear = "current" | "previous" | "next";

/**
 * Date range for queried data
 */
export interface DateRangeDto {
  /** ISO8601 date string (YYYY-MM-DD) */
  startDate: string;
  /** ISO8601 date string (YYYY-MM-DD) */
  endDate: string;
}

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
  wonLost: string;
  /** ISO8601 UTC timestamp */
  bidStartDate: string;
  /** ISO8601 UTC timestamp */
  bidEndDate: string | null;
  itemCode: string;
  itemDescription: string | null;
  erpStatus: string | null;
  bidQuantity: number | null;
  /** Last year bid quantity - "Coming Soon.." when not available */
  lastYearBidQty: number | string | null;
  /** Last year school year total sales amount - "Coming Soon.." when not available */
  lastYearActual: number | string | null;
  /** Last year August sales amount - "Coming Soon.." when not available */
  lastYearAugust: number | string | null;
  /** Last year September sales amount - "Coming Soon.." when not available */
  lastYearSeptember: number | string | null;
  /** Last year October sales amount - "Coming Soon.." when not available */
  lastYearOctober: number | string | null;
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
  /** Date range used for the query */
  dateRange: DateRangeDto;
}

/**
 * Query parameters for customer bids endpoint
 */
export interface CustomerBidQueryDto {
  page?: number;
  limit?: number;
  siteCode?: string;
  customerBillTo?: string;
  customerName?: string;
  salesRep?: string;
  itemCode?: string;
  erpStatus?: string;
  sourceDb?: string;
  wonLost?: "WON" | "LOST";
  /** School year filter - defaults to "next" */
  schoolYear?: SchoolYear;
}

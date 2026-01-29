/**
 * Customer Bids Types - Frontend type definitions for Customer Bids feature
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
 * Single customer bid record
 */
export interface CustomerBidDto {
  /** Source database identifier (e.g., "GSF", "NC") */
  sourceDb: string | null;
  siteCode: string | null;
  customerName: string | null;
  customerBillTo: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  salesRep: string | null;
  /** ISO8601 UTC timestamp */
  bidStartDate: string;
  /** ISO8601 UTC timestamp */
  bidEndDate: string | null;
  itemCode: string;
  itemDescription: string | null;
  erpStatus: string | null;
  bidQuantity: number | null;

  // Pre-calculated fields (populated by sync)
  /** Last year bid quantity */
  lastYearBidQty: number | null;
  /** Last year school year total sales amount */
  lastYearActual: number | null;
  /** Last year August sales amount */
  lyAugust: number | null;
  /** Last year September sales amount */
  lySeptember: number | null;
  /** Last year October sales amount */
  lyOctober: number | null;
  /** True if item was in previous year but NOT in current year */
  isLost: boolean;

  // User-editable fields
  /** User confirmation flag */
  confirmed: boolean;
  /** User's August demand forecast */
  augustDemand: number | null;
  /** User's September demand forecast */
  septemberDemand: number | null;
  /** User's October demand forecast */
  octoberDemand: number | null;
}

/**
 * Update payload for customer bid user-editable fields
 */
export interface UpdateCustomerBidDto {
  confirmed?: boolean;
  augustDemand?: number | null;
  septemberDemand?: number | null;
  octoberDemand?: number | null;
}

/**
 * Composite key to identify a customer bid record
 */
export interface CustomerBidKey {
  sourceDb: string;
  siteCode: string;
  customerBillTo: string;
  itemNo: string;
  schoolYear: string;
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
  customerBillTo?: string;
  customerName?: string;
  salesRep?: string;
  itemCode?: string;
  erpStatus?: string;
  /** School year filter - defaults to "next" */
  schoolYear?: SchoolYear;
}

/**
 * API response for customer bids list
 */
export interface CustomerBidListResponse {
  data: CustomerBidDto[];
  pagination: PaginationDto;
  /** Date range used for the query */
  dateRange: DateRangeDto;
}

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
  /** Customer co-op code */
  coOpCode: string | null;
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
  /** Brand name from Item.description_2 */
  brandName: string | null;
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

  // Last updated tracking
  /** ISO8601 UTC timestamp when last edited, or null if never edited */
  lastUpdatedAt: string | null;
  /** Email of user who last edited, or null if never edited */
  lastUpdatedBy: string | null;

  // Confirmation fields
  /** ISO8601 UTC timestamp when confirmed, or null if unconfirmed */
  confirmedAt: string | null;
  /** Email of user who confirmed, or null if unconfirmed */
  confirmedBy: string | null;

  // User-editable fields
  /** Year-around item flag */
  yearAround: boolean;

  // Monthly estimates (nullable decimal)
  estimateJan: number | null;
  estimateFeb: number | null;
  estimateMar: number | null;
  estimateApr: number | null;
  estimateMay: number | null;
  estimateJun: number | null;
  estimateJul: number | null;
  estimateAug: number | null;
  estimateSep: number | null;
  estimateOct: number | null;
  estimateNov: number | null;
  estimateDec: number | null;

  // Menu months - which months the item is on the menu (when not year-around)
  menuJan: boolean | null;
  menuFeb: boolean | null;
  menuMar: boolean | null;
  menuApr: boolean | null;
  menuMay: boolean | null;
  menuJun: boolean | null;
  menuJul: boolean | null;
  menuAug: boolean | null;
  menuSep: boolean | null;
  menuOct: boolean | null;
  menuNov: boolean | null;
  menuDec: boolean | null;
}

/**
 * Update payload for customer bid user-editable fields
 */
export interface UpdateCustomerBidDto {
  yearAround?: boolean;
  // Monthly estimates
  estimateJan?: number | null;
  estimateFeb?: number | null;
  estimateMar?: number | null;
  estimateApr?: number | null;
  estimateMay?: number | null;
  estimateJun?: number | null;
  estimateJul?: number | null;
  estimateAug?: number | null;
  estimateSep?: number | null;
  estimateOct?: number | null;
  estimateNov?: number | null;
  estimateDec?: number | null;
  // Menu months
  menuJan?: boolean | null;
  menuFeb?: boolean | null;
  menuMar?: boolean | null;
  menuApr?: boolean | null;
  menuMay?: boolean | null;
  menuJun?: boolean | null;
  menuJul?: boolean | null;
  menuAug?: boolean | null;
  menuSep?: boolean | null;
  menuOct?: boolean | null;
  menuNov?: boolean | null;
  menuDec?: boolean | null;
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
  coOpCode?: string;
  /** School year filter - defaults to "next" */
  schoolYear?: SchoolYear;
  /** Filter by renewed/new status (isLost) */
  isLost?: boolean;
  /** Filter by confirmation status - defaults to false (show unconfirmed) */
  confirmed?: boolean;
}

/**
 * Distinct filter option values for autocomplete suggestions
 */
export interface CustomerBidFilterOptions {
  siteCodes: string[];
  salesReps: string[];
  erpStatuses: string[];
  coOpCodes: string[];
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

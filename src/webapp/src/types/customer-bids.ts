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
  /** Pack size from Item table */
  packSize: string | null;
  /** Customer lead time from StockkeepingUnit table */
  customerLeadTime: number | null;
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
  /** Last year November sales amount */
  lyNovember: number | null;
  /** Last year December sales amount */
  lyDecember: number | null;
  /** Last year January sales amount */
  lyJanuary: number | null;
  /** Last year February sales amount */
  lyFebruary: number | null;
  /** Last year March sales amount */
  lyMarch: number | null;
  /** Last year April sales amount */
  lyApril: number | null;
  /** Last year May sales amount */
  lyMay: number | null;
  /** Last year June sales amount */
  lyJune: number | null;
  /** Last year July sales amount */
  lyJuly: number | null;
  /** True if item is in current year but NOT in previous year (new bid) */
  isNew: boolean;

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

  // Export tracking fields
  /** ISO8601 UTC timestamp when last exported, or null if never exported */
  lastExportedAt: string | null;
  /** Email of user who last exported, or null if never exported */
  lastExportedBy: string | null;

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
  /** Virtual flag for bulk import: true → confirmBid(), false → unconfirmBid() */
  confirmed?: boolean;
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
  /** Filter by renewed/new status */
  isNew?: boolean;
  /** Filter by confirmation status - defaults to false (show unconfirmed) */
  confirmed?: boolean;
  /** Filter by export status - true=exported only, false=not-exported only */
  exported?: boolean;
  /** Filter by queue status - true=queued only, false=not-queued only */
  queued?: boolean;
  /** Comma-separated item code prefixes to exclude (e.g., "6,8") */
  excludeItemPrefixes?: string;
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
 * Bulk update request payload - array of records with composite key + editable fields
 */
export interface BulkUpdateCustomerBidDto {
  records: Array<CustomerBidKey & UpdateCustomerBidDto>;
}

/**
 * Bulk update preview response — identifies which records would change
 */
export interface BulkUpdatePreviewResultDto {
  changed: number;
  unchanged: number;
  changedKeys: string[];
}

/**
 * Bulk update response - counts of updated/failed records with error details
 */
export interface BulkUpdateResultDto {
  updated: number;
  skipped: number;
  failed: number;
  errors?: Array<{
    key: string;
    message: string;
  }>;
}

/**
 * Per-location statistics
 */
export interface LocationStatsDto {
  siteCode: string;
  total: number;
  confirmed: number;
}

/**
 * Aggregate statistics for customer bids matching the current filters
 */
export interface CustomerBidStatsDto {
  totalItems: number;
  confirmedItems: number;
  byLocation: LocationStatsDto[];
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

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
  /** UUID primary key */
  id: string;
  /** Sales type: 0 = Direct, 3 = COOP */
  salesType: number;
  /** Source database identifier */
  sourceDb: string | null;
  siteCode: string | null;
  customerName: string | null;
  customerBillTo: string | null;
  /** Customer co-op code */
  coOpCode: string | null;
  /** Commercial co-op code (from COOP campaign) */
  comCoOpCode: string | null;
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
  /** Sum of open sales order quantities (shipment_date >= today) */
  openOrderQty: number;

  // Pre-calculated fields (from sync)
  /** Last year bid quantity (previous school year relative to current view) */
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

  // Current year monthly actuals (from sync)
  /** Current year August sales amount */
  cyAugust: number | null;
  /** Current year September sales amount */
  cySeptember: number | null;
  /** Current year October sales amount */
  cyOctober: number | null;
  /** Current year November sales amount */
  cyNovember: number | null;
  /** Current year December sales amount */
  cyDecember: number | null;
  /** Current year January sales amount */
  cyJanuary: number | null;
  /** Current year February sales amount */
  cyFebruary: number | null;
  /** Current year March sales amount */
  cyMarch: number | null;
  /** Current year April sales amount */
  cyApril: number | null;
  /** Current year May sales amount */
  cyMay: number | null;
  /** Current year June sales amount */
  cyJune: number | null;
  /** Current year July sales amount */
  cyJuly: number | null;

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

  // Export tracking
  /** ISO8601 UTC timestamp when last exported, or null if never exported */
  lastExportedAt: string | null;
  /** Email of user who triggered the export, or null if never exported */
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
  customerBillTo?: string[];
  customerName?: string;
  salesRep?: string;
  itemCode?: string;
  erpStatus?: string;
  coOpCode?: string;
  comCoOpCode?: string[];
  sourceDb?: string;
  /** Sales type filter - 0 = Direct, 3 = COOP */
  salesType?: number;
  isNew?: boolean;
  confirmed?: boolean;
  exported?: boolean;
  /** Filter by queue status - true=queued only, false=not-queued only */
  queued?: boolean;
  /** School year filter - defaults to "next" */
  schoolYear?: SchoolYear;
}

/**
 * Distinct filter option values for autocomplete suggestions
 */
export interface CustomerBidFilterOptionsDto {
  siteCodes: string[];
  salesReps: string[];
  erpStatuses: string[];
  coOpCodes: string[];
  comCoOpCodes: string[];
}

// ============================================
// Update DTOs
// ============================================

/**
 * Composite key for identifying a customer bid record
 */
export interface CustomerBidKeyDto {
  id: string;
}

/**
 * DTO for updating user-editable fields on a customer bid
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
 * DTO for bulk updating multiple customer bids
 */
export interface BulkUpdateCustomerBidDto {
  records: Array<{ id: string } & UpdateCustomerBidDto>;
}

/**
 * Response for bulk update preview — identifies which records would change
 */
export interface BulkUpdatePreviewResultDto {
  changed: number;
  unchanged: number;
  /** UUIDs of records that would change */
  changedKeys: string[];
}

/**
 * Response for bulk update operation
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

// ============================================
// Sync DTOs
// ============================================

/**
 * Result of a sync operation
 */
export interface SyncResultDto {
  syncId: string;
  status: "COMPLETED" | "FAILED";
  schoolYear: string;
  recordsTotal: number;
  recordsInserted: number;
  recordsUpdated: number;
  durationMs: number;
}

/**
 * Sync log entry DTO
 */
// ============================================
// Statistics DTOs
// ============================================

/**
 * Per-location statistics for customer bids
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

export interface SyncLogDto {
  id: string;
  status: string;
  schoolYear: string;
  startedAt: string;
  completedAt: string | null;
  recordsTotal: number | null;
  recordsInserted: number | null;
  recordsUpdated: number | null;
  errorMessage: string | null;
  durationMs: number | null;
  triggeredBy: string;
}

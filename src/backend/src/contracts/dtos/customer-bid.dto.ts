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
  /** Source database identifier */
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
  /** Brand name from Item.description_2 */
  brandName: string | null;
  erpStatus: string | null;
  bidQuantity: number | null;

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
  /** True if item was in previous year but NOT in current year */
  isLost: boolean;

  // User-editable fields
  /** User confirmation flag */
  confirmed: boolean;
  /** Year-around item flag */
  yearAround: boolean;
  /** User's August demand forecast */
  augustDemand: number | null;
  /** User's September demand forecast */
  septemberDemand: number | null;
  /** User's October demand forecast */
  octoberDemand: number | null;

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
  isLost?: boolean;
  confirmed?: boolean;
  /** School year filter - defaults to "next" */
  schoolYear?: SchoolYear;
}

// ============================================
// Update DTOs
// ============================================

/**
 * Composite key for identifying a customer bid record
 */
export interface CustomerBidKeyDto {
  sourceDb: string;
  siteCode: string;
  customerBillTo: string;
  itemNo: string;
  schoolYear: string;
}

/**
 * DTO for updating user-editable fields on a customer bid
 */
export interface UpdateCustomerBidDto {
  confirmed?: boolean;
  yearAround?: boolean;
  augustDemand?: number | null;
  septemberDemand?: number | null;
  octoberDemand?: number | null;
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
 * DTO for bulk updating multiple customer bids
 */
export interface BulkUpdateCustomerBidDto {
  records: Array<CustomerBidKeyDto & UpdateCustomerBidDto>;
}

/**
 * Response for bulk update operation
 */
export interface BulkUpdateResultDto {
  updated: number;
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

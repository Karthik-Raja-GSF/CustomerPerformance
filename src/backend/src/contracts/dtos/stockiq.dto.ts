/**
 * StockIQ DTOs - Data Transfer Objects for API layer
 */

/**
 * Sync result DTO returned after a sync operation
 */
export interface SyncResultDto {
  syncId: string;
  status: "COMPLETED" | "FAILED";
  recordsTotal: number;
  recordsInserted: number;
  recordsUpdated: number;
  durationMs: number;
  apiResponseStatus?: number;
  errorMessage?: string;
}

/**
 * Sync log DTO for sync history
 *
 * All timestamps are in UTC with ISO8601 format
 */
export interface SyncLogDto {
  id: string;
  status: string;
  /** ISO8601 UTC timestamp */
  startedAt: string;
  /** ISO8601 UTC timestamp */
  completedAt: string | null;
  recordsTotal: number | null;
  recordsInserted: number | null;
  recordsUpdated: number | null;
  recordsDeleted: number | null;
  apiResponseStatus: number | null;
  apiResponseTimeMs: number | null;
  apiErrorMessage: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  triggeredBy: string;
}

/**
 * Orphaned record identifier DTO
 */
export interface OrphanedRecordDto {
  siteCode: string;
  itemCode: string;
  /** ISO8601 UTC timestamp of when record was last synced */
  syncedAt: string;
}

/**
 * Delete orphans result DTO
 */
export interface DeleteOrphansResultDto {
  deletedCount: number;
  /** ISO8601 UTC timestamp */
  deletedAt: string;
}

/**
 * StockIQ API response item (raw from API)
 */
export interface StockIqApiResponseItem {
  SiteCode: string;
  Company: string;
  ItemCode: string;
  ItemDescription: string;
  PrimarySupplierName: string;
  PrimarySupplierCode: string;
  "Active Planning LT": number;
  "Category Class": string;
  Zone: string;
  "Erp Item Status": string;
  "Shelf Life": string;
  "Conditional Status": string;
  "Challange Status": string;
  "Priority Tag": string;
  "ABC Class": string;
  "Safety Stock": number | null;
  "On Hand Quantity": number | null;
  "On Order": number | null;
  "Open Sales": number | null;
  "Open Estimates": number | null;
  "Open Sales + Open Estimates": number | null;
  "Next PO Date": string | null;
  "Next PO Quantity": number | null;
  "Month -3 Actuals": number | null;
  "Month -2 Actuals": number | null;
  "Last Month Actuals": number | null;
  "Current Month Sales": number | null;
  "Current Month Forecast": number | null;
  "Month +1 Forecast": number | null;
  "Month +2 Forecast": number | null;
  "Month +3 Forecast": number | null;
  "Month +4 Forecast": number | null;
  "Last SY Actuals (Aug - May)": number | null;
  "Current SY Actuals (Aug - May)": number | null;
  "Next Month Actuals from Last Year": number | null;
  "+2 Actuals Last Year": number | null;
  "+3 Actuals Last Year": number | null;
  "Weeks Supply Onhand": string | null;
  "Weeks OnHand Est": string | null;
  "Forecast Variance MTD": string | null;
  "Supply Variance": number | null;
  "Target Stock": number | null;
  "Preferred Max": number | null;
  "Max Stock": number | null;
  "Top 5 Customer Ship-To's": string | null;
  "Total Customers": number | null;
  Buyer: string | null;
}

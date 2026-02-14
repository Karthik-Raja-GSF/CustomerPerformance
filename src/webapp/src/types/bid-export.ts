/**
 * Bid Export Types - Frontend type definitions for Bid Export Queue feature
 */

export type BidExportType = "CSV" | "SIQ";
export type BidExportItemStatus = "QUEUED" | "EXPORTED" | "CANCELLED";
export type BidExportRunStatus = "IN_PROGRESS" | "COMPLETED" | "FAILED";

/**
 * Request payload for queueing bid items for export
 */
export interface QueueBidExportRequest {
  exportType: BidExportType;
  schoolYear: string;
  filters: Record<string, unknown>;
}

/**
 * Response after queueing items
 */
export interface QueueBidExportResult {
  itemsQueued: number;
}

/**
 * Request payload for marking queued items as exported
 */
export interface MarkExportedRequest {
  exportType: BidExportType;
}

/**
 * Response after marking items exported
 */
export interface MarkExportedResult {
  runId: string;
  totalExported: number;
}

/**
 * Queue summary — count of QUEUED items by export type
 */
export interface QueueSummary {
  csv: number;
  siq: number;
  total: number;
}

/**
 * Request payload for queueing bid items by explicit composite keys
 */
export interface QueueBidExportByKeysRequest {
  exportType: BidExportType;
  keys: Array<{
    sourceDb: string;
    siteCode: string;
    customerBillTo: string;
    itemNo: string;
    schoolYear: string;
  }>;
}

/**
 * Request payload for cancelling queued bid items by explicit composite keys
 */
export interface CancelBidExportByKeysRequest {
  exportType?: BidExportType;
  keys: Array<{
    sourceDb: string;
    siteCode: string;
    customerBillTo: string;
    itemNo: string;
    schoolYear: string;
  }>;
}

/**
 * Response from atomic export — marks QUEUED→EXPORTED and returns bid data
 */
export interface ExportResult {
  runId: string;
  totalExported: number;
  data: import("@/types/customer-bids").CustomerBidDto[];
}

/**
 * Export run log record
 */
export interface BidExportRunDto {
  id: string;
  status: BidExportRunStatus;
  exportType: BidExportType;
  triggeredBy: string;
  totalRecords: number | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
}

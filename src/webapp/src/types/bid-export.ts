/**
 * Bid Export Types - Frontend type definitions for Bid Export Queue feature
 */

export type BidExportType = "WH" | "NAV";
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
  wh: number;
  nav: number;
  total: number;
}

/**
 * Request payload for queueing bid items by UUIDs
 */
export interface QueueBidExportByIdsRequest {
  exportType: BidExportType;
  bidIds: string[];
}

/**
 * Request payload for cancelling queued bid items by UUIDs
 */
export interface CancelBidExportByIdsRequest {
  exportType?: BidExportType;
  bidIds: string[];
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

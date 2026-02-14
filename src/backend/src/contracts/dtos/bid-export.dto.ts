/**
 * Bid Export DTOs - Data Transfer Objects for Bid Export Queue API
 */

import type { CustomerBidDto } from "@/contracts/dtos/customer-bid.dto";

export type BidExportType = "CSV" | "SIQ";
export type BidExportItemStatus = "QUEUED" | "EXPORTED" | "CANCELLED";
export type BidExportRunStatus = "IN_PROGRESS" | "COMPLETED" | "FAILED";

/**
 * Request DTO for queueing bid items for export
 */
export interface QueueBidExportDto {
  exportType: BidExportType;
  schoolYear: string;
  filters: Record<string, unknown>;
}

/**
 * Response DTO after queueing items
 */
export interface QueueBidExportResultDto {
  itemsQueued: number;
}

/**
 * Request DTO for marking queued items as exported
 */
export interface MarkExportedDto {
  exportType: BidExportType;
}

/**
 * Response DTO after marking items exported
 */
export interface MarkExportedResultDto {
  runId: string;
  totalExported: number;
}

/**
 * Single export item DTO
 */
export interface BidExportItemDto {
  id: string;
  sourceDb: string;
  siteCode: string;
  customerBillTo: string;
  itemNo: string;
  schoolYear: string;
  exportType: BidExportType;
  status: BidExportItemStatus;
  queuedBy: string;
  queuedAt: string;
  runId: string | null;
}

/**
 * Export run log DTO
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

/**
 * Queue summary — count of QUEUED items by export type
 */
export interface QueueSummaryDto {
  csv: number;
  siq: number;
  total: number;
}

/**
 * Request DTO for queueing bid items by explicit composite keys
 */
export interface QueueBidExportByKeysDto {
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
 * Request DTO for cancelling queued bid items by explicit composite keys
 */
export interface CancelBidExportByKeysDto {
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
 * Response DTO for atomic export — marks QUEUED→EXPORTED and returns bid data
 */
export interface ExportResultDto {
  runId: string;
  totalExported: number;
  data: CustomerBidDto[];
}

/**
 * Result of processing pending exports (scheduler)
 */
export interface BidExportProcessResultDto {
  runsCreated: number;
  totalProcessed: number;
  failed: number;
}

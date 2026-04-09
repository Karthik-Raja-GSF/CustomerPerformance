/**
 * Bid Export DTOs - Data Transfer Objects for Bid Export Queue API
 */

import type { CustomerBidDto } from "@/contracts/dtos/customer-bid.dto";

export type BidExportType = "WH" | "NAV";
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
  bidId: string;
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
  wh: number;
  nav: number;
  total: number;
}

/**
 * Request DTO for queueing bid items by UUIDs
 */
export interface QueueBidExportByIdsDto {
  exportType: BidExportType;
  bidIds: string[];
}

/**
 * Request DTO for cancelling queued bid items by UUIDs
 */
export interface CancelBidExportByIdsDto {
  exportType?: BidExportType;
  bidIds: string[];
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

/**
 * Monthly estimates grouped in a nested object
 */
export interface WebhookEstimatesDto {
  jan: number | null;
  feb: number | null;
  mar: number | null;
  apr: number | null;
  may: number | null;
  jun: number | null;
  jul: number | null;
  aug: number | null;
  sep: number | null;
  oct: number | null;
  nov: number | null;
  dec: number | null;
}

/**
 * Single bid row returned by the webhook GET endpoint.
 * Uses composite key fields + nested estimates.
 */
export interface WebhookBidRowDto {
  sourceDb: string | null;
  itemCode: string;
  siteCode: string | null;
  customerBillToCode: string | null;
  schoolYear: string;
  customerName: string | null;
  estimates: WebhookEstimatesDto;
}

/**
 * Response for GET /webhook/nav — prepare export and return bid data
 */
export interface WebhookExportResultDto {
  runId: string | null;
  data: WebhookBidRowDto[];
}

/**
 * Response for POST /webhook/nav/:runId/complete — confirm export success
 */
export interface WebhookCompleteResultDto {
  runId: string;
  totalExported: number;
}

/**
 * Bid Export API Client
 *
 * API client for Bid Export Queue operations — queueing, exporting, and tracking
 */

import { apiClient } from "@/apis/client";
import type {
  BidExportType,
  QueueBidExportRequest,
  QueueBidExportByIdsRequest,
  CancelBidExportByIdsRequest,
  QueueBidExportResult,
  ExportResult,
  QueueSummary,
  BidExportRunDto,
} from "@/types/bid-export";

// API response wrapper type
interface ApiResponse<T> {
  status: string;
  data: T;
}

/**
 * Queue bid items for export based on current filters
 */
export async function queueBidExport(
  data: QueueBidExportRequest
): Promise<QueueBidExportResult> {
  const response = await apiClient.post<ApiResponse<QueueBidExportResult>>(
    "/bid-exports/queue",
    data
  );
  return response.data;
}

/**
 * Queue bid items for export using explicit UUIDs
 */
export async function queueBidExportByIds(
  data: QueueBidExportByIdsRequest
): Promise<QueueBidExportResult> {
  const response = await apiClient.post<ApiResponse<QueueBidExportResult>>(
    "/bid-exports/queue-by-ids",
    data
  );
  return response.data;
}

/**
 * Atomically mark QUEUED items as EXPORTED and return full bid data for CSV generation
 */
export async function exportAndReturn(
  exportType: BidExportType
): Promise<ExportResult> {
  const response = await apiClient.post<ApiResponse<ExportResult>>(
    "/bid-exports/export",
    { exportType }
  );
  return response.data;
}

/**
 * Get queue summary — count of QUEUED items by export type
 */
export async function getQueueSummary(): Promise<QueueSummary> {
  const response = await apiClient.get<ApiResponse<QueueSummary>>(
    "/bid-exports/queue-summary"
  );
  return response.data;
}

/**
 * Cancel QUEUED items by explicit UUIDs
 */
export async function cancelBidExportByIds(
  data: CancelBidExportByIdsRequest
): Promise<{ cancelled: number }> {
  const response = await apiClient.post<ApiResponse<{ cancelled: number }>>(
    "/bid-exports/cancel-by-ids",
    data
  );
  return response.data;
}

/**
 * Clear export tracking (last_exported_at/by) on customer_bid_data by UUIDs
 */
export async function clearExportByIds(
  bidIds: string[]
): Promise<{ cleared: number }> {
  const response = await apiClient.post<ApiResponse<{ cleared: number }>>(
    "/bid-exports/clear-export-by-ids",
    { bidIds }
  );
  return response.data;
}

/**
 * Cancel all QUEUED items (optionally by export type)
 */
export async function cancelQueuedExports(
  exportType?: BidExportType
): Promise<{ cancelled: number }> {
  const response = await apiClient.post<ApiResponse<{ cancelled: number }>>(
    "/bid-exports/cancel",
    exportType ? { exportType } : {}
  );
  return response.data;
}

/**
 * Get export run history
 */
export async function getBidExportRuns(limit = 20): Promise<BidExportRunDto[]> {
  const response = await apiClient.get<ApiResponse<BidExportRunDto[]>>(
    `/bid-exports/runs?limit=${limit}`
  );
  return response.data;
}

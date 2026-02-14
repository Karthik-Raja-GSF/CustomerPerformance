/**
 * Bid Export API Client
 *
 * API client for Bid Export Queue operations — queueing, exporting, and tracking
 */

import { apiClient } from "@/apis/client";
import type {
  BidExportType,
  QueueBidExportRequest,
  QueueBidExportByKeysRequest,
  CancelBidExportByKeysRequest,
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
 * Queue bid items for export using explicit composite keys
 */
export async function queueBidExportByKeys(
  data: QueueBidExportByKeysRequest
): Promise<QueueBidExportResult> {
  const response = await apiClient.post<ApiResponse<QueueBidExportResult>>(
    "/bid-exports/queue-by-keys",
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
 * Cancel QUEUED items by explicit composite keys
 */
export async function cancelBidExportByKeys(
  data: CancelBidExportByKeysRequest
): Promise<{ cancelled: number }> {
  const response = await apiClient.post<ApiResponse<{ cancelled: number }>>(
    "/bid-exports/cancel-by-keys",
    data
  );
  return response.data;
}

/**
 * Clear export tracking (last_exported_at/by) on customer_bid_data by composite keys
 */
export async function clearExportByKeys(
  keys: Array<{
    sourceDb: string;
    siteCode: string;
    customerBillTo: string;
    itemNo: string;
    schoolYear: string;
  }>
): Promise<{ cleared: number }> {
  const response = await apiClient.post<ApiResponse<{ cleared: number }>>(
    "/bid-exports/clear-export-by-keys",
    { keys }
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

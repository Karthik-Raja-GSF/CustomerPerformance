/**
 * StockIQ API Client
 *
 * API client for StockIQ sync operations - history, status, manual sync, and orphan management
 */

import { apiClient } from "@/apis/client";

// Types
export type SyncStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

export interface SyncLog {
  id: string;
  status: SyncStatus;
  startedAt: string;
  completedAt: string | null;
  recordsTotal: number | null;
  recordsInserted: number | null;
  recordsUpdated: number | null;
  recordsDeleted: number | null;
  durationMs: number | null;
  triggeredBy: string;
  apiResponseStatus: number | null;
  apiResponseTimeMs: number | null;
  apiErrorMessage: string | null;
  errorMessage: string | null;
}

export interface SyncResult {
  syncId: string;
  status: string;
  recordsTotal: number;
  recordsInserted: number;
  recordsUpdated: number;
  durationMs: number;
  apiResponseStatus: number | null;
  errorMessage: string | null;
}

export interface OrphanedRecord {
  siteCode: string;
  itemCode: string;
  syncedAt: string;
}

export interface DeleteOrphansResult {
  deletedCount: number;
  deletedAt: string;
}

// API response wrapper type
interface ApiResponse<T> {
  status: string;
  data: T;
}

/**
 * Get sync history
 * @param limit - Maximum number of records to return (default 20, max 100)
 */
export async function getSyncHistory(limit?: number): Promise<SyncLog[]> {
  const params = limit ? { limit: String(limit) } : undefined;
  const response = await apiClient.get<ApiResponse<SyncLog[]>>(
    "/stockiq/sync/history",
    { params }
  );
  return response.data;
}

/**
 * Get the latest sync status
 */
export async function getLatestSyncStatus(): Promise<SyncLog | null> {
  const response = await apiClient.get<ApiResponse<SyncLog | null>>(
    "/stockiq/sync/status"
  );
  return response.data;
}

/**
 * Trigger a manual sync
 */
export async function triggerSync(): Promise<SyncResult> {
  const response =
    await apiClient.post<ApiResponse<SyncResult>>("/stockiq/sync");
  return response.data;
}

/**
 * Get orphaned records (in database but not in StockIQ API)
 */
export async function getOrphanedRecords(): Promise<OrphanedRecord[]> {
  const response =
    await apiClient.get<ApiResponse<OrphanedRecord[]>>("/stockiq/orphans");
  return response.data;
}

/**
 * Delete all orphaned records
 */
export async function deleteOrphanedRecords(): Promise<DeleteOrphansResult> {
  const response =
    await apiClient.delete<ApiResponse<DeleteOrphansResult>>(
      "/stockiq/orphans"
    );
  return response.data;
}

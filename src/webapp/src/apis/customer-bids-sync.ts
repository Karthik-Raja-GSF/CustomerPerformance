/**
 * Customer Bids Sync API Client
 *
 * API client for Customer Bids sync operations - history, status, and manual sync
 */

import { apiClient } from "@/apis/client";

// Types
export type SyncStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
export type SchoolYear = "current" | "previous" | "next";

export interface SyncLog {
  id: string;
  status: SyncStatus;
  schoolYear: string;
  startedAt: string;
  completedAt: string | null;
  recordsTotal: number | null;
  recordsInserted: number | null;
  recordsUpdated: number | null;
  durationMs: number | null;
  triggeredBy: string;
  errorMessage: string | null;
}

export interface SyncResult {
  syncId: string;
  status: string;
  schoolYear: string;
  recordsTotal: number;
  recordsInserted: number;
  recordsUpdated: number;
  durationMs: number;
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
    "/customer-bids/sync/history",
    { params }
  );
  return response.data;
}

/**
 * Get the latest sync status
 */
export async function getLatestSyncStatus(): Promise<SyncLog | null> {
  const response = await apiClient.get<ApiResponse<SyncLog | null>>(
    "/customer-bids/sync/status"
  );
  return response.data;
}

/**
 * Trigger a manual sync for a specific school year
 * @param schoolYear - School year to sync ("current", "previous", or "next")
 */
export async function triggerSync(schoolYear: SchoolYear): Promise<SyncResult> {
  const response = await apiClient.post<ApiResponse<SyncResult>>(
    "/customer-bids/sync",
    { schoolYear }
  );
  return response.data;
}

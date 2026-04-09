/**
 * Customer Bids API Client
 *
 * API client for Customer Bids operations - fetching and updating bid records
 */

import { apiClient } from "@/apis/client";
import type {
  CustomerBidDto,
  CustomerBidFilters,
  CustomerBidFilterOptions,
  CustomerBidListResponse,
  CustomerBidStatsDto,
  UpdateCustomerBidDto,
  BulkUpdateCustomerBidDto,
  BulkUpdateResultDto,
  BulkUpdatePreviewResultDto,
} from "@/types/customer-bids";

// API response wrapper type
interface ApiResponse<T> {
  status: string;
  data: T;
}

/**
 * Fetch customer bids with optional filters
 */
export async function getCustomerBids(
  filters?: CustomerBidFilters
): Promise<CustomerBidListResponse> {
  const params = new URLSearchParams();

  if (filters?.page) params.set("page", filters.page.toString());
  if (filters?.limit) params.set("limit", filters.limit.toString());
  if (filters?.schoolYear) params.set("schoolYear", filters.schoolYear);
  if (filters?.siteCode) params.set("siteCode", filters.siteCode);
  if (filters?.customerBillTo)
    params.set("customerBillTo", filters.customerBillTo);
  if (filters?.customerName) params.set("customerName", filters.customerName);
  if (filters?.salesRep) params.set("salesRep", filters.salesRep);
  if (filters?.itemCode) params.set("itemCode", filters.itemCode);
  if (filters?.erpStatus) params.set("erpStatus", filters.erpStatus);
  if (filters?.coOpCode) params.set("coOpCode", filters.coOpCode);
  if (filters?.salesType !== undefined)
    params.set("salesType", filters.salesType.toString());
  if (filters?.isNew !== undefined)
    params.set("isNew", filters.isNew.toString());
  if (filters?.confirmed !== undefined)
    params.set("confirmed", filters.confirmed.toString());
  if (filters?.exported !== undefined)
    params.set("exported", filters.exported.toString());
  if (filters?.queued !== undefined)
    params.set("queued", filters.queued.toString());
  if (filters?.excludeItemPrefixes)
    params.set("excludeItemPrefixes", filters.excludeItemPrefixes);

  const queryString = params.toString();
  const url = `/customer-bids${queryString ? `?${queryString}` : ""}`;

  const response =
    await apiClient.get<ApiResponse<CustomerBidListResponse>>(url);

  // The API wraps the response in { status, data, pagination, dateRange }
  // but the actual structure is { status, ...CustomerBidListResponse }
  // so we extract the needed fields
  return response as unknown as CustomerBidListResponse;
}

/**
 * Fetch aggregate statistics for customer bids matching the given filters.
 * Same filters as getCustomerBids, but pagination is ignored.
 */
export async function getCustomerBidStats(
  filters?: CustomerBidFilters
): Promise<CustomerBidStatsDto> {
  const params = new URLSearchParams();

  if (filters?.schoolYear) params.set("schoolYear", filters.schoolYear);
  if (filters?.siteCode) params.set("siteCode", filters.siteCode);
  if (filters?.customerBillTo)
    params.set("customerBillTo", filters.customerBillTo);
  if (filters?.customerName) params.set("customerName", filters.customerName);
  if (filters?.salesRep) params.set("salesRep", filters.salesRep);
  if (filters?.itemCode) params.set("itemCode", filters.itemCode);
  if (filters?.erpStatus) params.set("erpStatus", filters.erpStatus);
  if (filters?.coOpCode) params.set("coOpCode", filters.coOpCode);
  if (filters?.salesType !== undefined)
    params.set("salesType", filters.salesType.toString());
  if (filters?.isNew !== undefined)
    params.set("isNew", filters.isNew.toString());
  if (filters?.confirmed !== undefined)
    params.set("confirmed", filters.confirmed.toString());
  if (filters?.exported !== undefined)
    params.set("exported", filters.exported.toString());
  if (filters?.queued !== undefined)
    params.set("queued", filters.queued.toString());
  if (filters?.excludeItemPrefixes)
    params.set("excludeItemPrefixes", filters.excludeItemPrefixes);

  const queryString = params.toString();
  const url = `/customer-bids/stats${queryString ? `?${queryString}` : ""}`;

  const response = await apiClient.get<ApiResponse<CustomerBidStatsDto>>(url);
  return response.data;
}

/**
 * Build the REST path for a customer bid record by UUID
 */
function buildBidPath(id: string): string {
  return `/customer-bids/${encodeURIComponent(id)}`;
}

/**
 * Update a customer bid record's user-editable fields
 */
export async function updateCustomerBid(
  id: string,
  updates: UpdateCustomerBidDto
): Promise<CustomerBidDto> {
  const response = await apiClient.patch<ApiResponse<CustomerBidDto>>(
    buildBidPath(id),
    updates
  );
  return response.data;
}

/**
 * Confirm a customer bid record (sets confirmed_at and confirmed_by)
 */
export async function confirmCustomerBid(id: string): Promise<CustomerBidDto> {
  const response = await apiClient.post<ApiResponse<CustomerBidDto>>(
    `${buildBidPath(id)}/confirm`
  );
  return response.data;
}

/**
 * Unconfirm a customer bid record (clears confirmed_at and confirmed_by)
 */
export async function unconfirmCustomerBid(
  id: string
): Promise<CustomerBidDto> {
  const response = await apiClient.post<ApiResponse<CustomerBidDto>>(
    `${buildBidPath(id)}/unconfirm`
  );
  return response.data;
}

/**
 * Bulk update multiple customer bid records
 * Sends to POST /customer-bids/bulk-update (max 1000 records per request)
 */
export async function bulkUpdateCustomerBids(
  payload: BulkUpdateCustomerBidDto
): Promise<BulkUpdateResultDto> {
  const response = await apiClient.post<
    { status: string } & BulkUpdateResultDto
  >("/customer-bids/bulk-update", payload);
  return {
    updated: response.updated,
    skipped: response.skipped,
    failed: response.failed,
    errors: response.errors,
  };
}

/**
 * Preview which records in a bulk update would actually change (read-only)
 */
export async function previewBulkUpdateBids(
  payload: BulkUpdateCustomerBidDto
): Promise<BulkUpdatePreviewResultDto> {
  const response = await apiClient.post<
    { status: string } & BulkUpdatePreviewResultDto
  >("/customer-bids/bulk-update/preview", payload);
  return {
    changed: response.changed,
    unchanged: response.unchanged,
    changedKeys: response.changedKeys,
  };
}

/**
 * Fetch distinct filter option values for autocomplete suggestions
 */
export async function getCustomerBidFilterOptions(): Promise<CustomerBidFilterOptions> {
  const response = await apiClient.get<ApiResponse<CustomerBidFilterOptions>>(
    "/customer-bids/filter-options"
  );
  return response.data;
}

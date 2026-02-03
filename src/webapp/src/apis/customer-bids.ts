/**
 * Customer Bids API Client
 *
 * API client for Customer Bids operations - fetching and updating bid records
 */

import { apiClient } from "@/apis/client";
import type {
  CustomerBidDto,
  CustomerBidKey,
  CustomerBidFilters,
  CustomerBidFilterOptions,
  CustomerBidListResponse,
  UpdateCustomerBidDto,
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
 * Update a customer bid record's user-editable fields
 *
 * @param key - Composite key identifying the record
 * @param updates - Fields to update (confirmed, augustDemand, septemberDemand, octoberDemand)
 * @returns Updated CustomerBidDto
 */
export async function updateCustomerBid(
  key: CustomerBidKey,
  updates: UpdateCustomerBidDto
): Promise<CustomerBidDto> {
  const { sourceDb, siteCode, customerBillTo, itemNo, schoolYear } = key;
  const path = `/customer-bids/${encodeURIComponent(sourceDb)}/${encodeURIComponent(siteCode)}/${encodeURIComponent(customerBillTo)}/${encodeURIComponent(itemNo)}/${encodeURIComponent(schoolYear)}`;

  const response = await apiClient.patch<ApiResponse<CustomerBidDto>>(
    path,
    updates
  );
  return response.data;
}

/**
 * Build a CustomerBidKey from a CustomerBidDto and school year
 *
 * @param bid - The bid record
 * @param schoolYear - The school year string (e.g., "2026-2027")
 * @returns CustomerBidKey for API calls
 */
/**
 * Fetch distinct filter option values for autocomplete suggestions
 */
export async function getCustomerBidFilterOptions(): Promise<CustomerBidFilterOptions> {
  const response = await apiClient.get<ApiResponse<CustomerBidFilterOptions>>(
    "/customer-bids/filter-options"
  );
  return response.data;
}

export function buildBidKey(
  bid: CustomerBidDto,
  schoolYear: string
): CustomerBidKey {
  return {
    sourceDb: bid.sourceDb || "",
    siteCode: bid.siteCode || "",
    customerBillTo: bid.customerBillTo || "",
    itemNo: bid.itemCode,
    schoolYear,
  };
}

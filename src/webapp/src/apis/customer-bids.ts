/**
 * Customer Bids API Client
 *
 * API client for fetching customer bid data with filtering and pagination
 */

import { apiClient } from "@/apis/client";
import type {
  CustomerBidFilters,
  CustomerBidListResponse,
} from "@/types/customer-bids";

/**
 * Get customer bids with optional filters and pagination
 * @param filters - Query parameters for filtering and pagination
 */
export async function getCustomerBids(
  filters?: CustomerBidFilters
): Promise<CustomerBidListResponse> {
  const params: Record<string, string> = {};

  if (filters) {
    if (filters.page !== undefined) params.page = String(filters.page);
    if (filters.limit !== undefined) params.limit = String(filters.limit);
    if (filters.schoolYear) params.schoolYear = filters.schoolYear;
    if (filters.siteCode) params.siteCode = filters.siteCode;
    if (filters.customerBillTo) params.customerBillTo = filters.customerBillTo;
    if (filters.customerName) params.customerName = filters.customerName;
    if (filters.salesRep) params.salesRep = filters.salesRep;
    if (filters.itemCode) params.itemCode = filters.itemCode;
    if (filters.erpStatus) params.erpStatus = filters.erpStatus;
  }

  return apiClient.get<CustomerBidListResponse>("/customer-bids", {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
}

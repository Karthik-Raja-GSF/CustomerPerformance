import { apiClient } from "@/apis/client";
import type {
  EoRiskReviewListResponse,
  EoRiskReviewFilters,
  EoFilterOptions,
} from "@/types/eo-risk-review";

/**
 * Fetch paginated risk review items with optional filters and thresholds.
 */
export async function getEoRiskItems(
  filters: EoRiskReviewFilters
): Promise<EoRiskReviewListResponse> {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("limit", String(filters.limit));
  params.set("agingDays", String(filters.agingDays));
  params.set("lookbackDays", String(filters.lookbackDays));
  params.set("excessDays", String(filters.excessDays));
  if (filters.location) params.set("location", filters.location);
  if (filters.itemNo) params.set("itemNo", filters.itemNo);
  if (filters.sourceDb) params.set("sourceDb", filters.sourceDb);

  return apiClient.get<EoRiskReviewListResponse>(
    `/eo-risk-review?${params.toString()}`
  );
}

/**
 * Fetch distinct filter option values for the filter sheet.
 */
export async function getEoFilterOptions(): Promise<EoFilterOptions> {
  const res = await apiClient.get<{ status: string; data: EoFilterOptions }>(
    "/eo-risk-review/filter-options"
  );
  return res.data;
}

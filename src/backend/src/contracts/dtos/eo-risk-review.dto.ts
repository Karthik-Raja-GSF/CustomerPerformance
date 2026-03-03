/**
 * E&O Risk Review DTOs
 *
 * Data transfer objects for the Risk Review API.
 * Items are computed on-the-fly from pallet_bin_content + item_ledger_entry.
 */

/** Configurable threshold parameters */
export interface EoThresholdsDto {
  agingDays: number;
  lookbackDays: number;
  excessDays: number;
}

/** Query parameters for the risk review list endpoint */
export interface EoRiskReviewQueryDto {
  page: number;
  limit: number;
  location?: string;
  itemNo?: string;
  sourceDb?: string;
  agingDays: number;
  lookbackDays: number;
  excessDays: number;
}

/** Single risk item returned by the API */
export interface EoRiskItemDto {
  sourceDb: string;
  location: string;
  itemNo: string;
  description: string | null;
  vendorName: string | null;
  vendorNo: string | null;
  buyerName: string | null;
  quantity: number;
  totalValue: number | null;
  daysInInventory: number;
  expirationDate: string | null;
  avgWeeklySale: number;
  criteriaMet: string[];
}

/** Paginated list response */
export interface EoRiskReviewListResponseDto {
  data: EoRiskItemDto[];
  page: number;
  limit: number;
  hasMore: boolean;
  totalItemsAtRisk: number;
  thresholds: EoThresholdsDto;
}

/** Filter autocomplete options */
export interface EoFilterOptionsDto {
  locations: string[];
  sourceDbs: string[];
}

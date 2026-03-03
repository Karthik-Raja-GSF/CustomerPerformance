/** Configurable threshold parameters */
export interface EoThresholds {
  agingDays: number;
  lookbackDays: number;
  excessDays: number;
}

/** Single risk item from the API */
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

/** Query parameters for the risk review endpoint */
export interface EoRiskReviewFilters {
  page: number;
  limit: number;
  location?: string;
  itemNo?: string;
  sourceDb?: string;
  agingDays: number;
  lookbackDays: number;
  excessDays: number;
}

/** API list response */
export interface EoRiskReviewListResponse {
  status: string;
  data: EoRiskItemDto[];
  page: number;
  limit: number;
  hasMore: boolean;
  totalItemsAtRisk: number;
  thresholds: EoThresholds;
}

/** Filter autocomplete options */
export interface EoFilterOptions {
  locations: string[];
  sourceDbs: string[];
}

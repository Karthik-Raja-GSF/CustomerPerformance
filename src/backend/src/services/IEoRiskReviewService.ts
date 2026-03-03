import type {
  EoRiskReviewQueryDto,
  EoRiskReviewListResponseDto,
  EoFilterOptionsDto,
} from "@/contracts/dtos/eo-risk-review.dto";

/**
 * E&O Risk Review Service Interface
 *
 * Computes risk items on-the-fly from READ-ONLY NAV tables
 * (pallet_bin_content, item_ledger_entry, item, vendor, stockkeeping_unit).
 */
export const EO_RISK_REVIEW_SERVICE_TOKEN = Symbol.for("IEoRiskReviewService");

export interface IEoRiskReviewService {
  /**
   * Get paginated list of items meeting at least one risk criteria.
   * All criteria are evaluated per item+location and returned as criteriaMet badges.
   */
  getRiskItems(
    query: EoRiskReviewQueryDto
  ): Promise<EoRiskReviewListResponseDto>;

  /**
   * Get distinct filter option values for the filter sheet.
   */
  getFilterOptions(): Promise<EoFilterOptionsDto>;
}

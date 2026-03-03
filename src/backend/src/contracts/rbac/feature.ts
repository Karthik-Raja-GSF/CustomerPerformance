/**
 * Feature Constants
 *
 * Each feature maps to a frontend page/section and its backing API routes.
 * Used by both `requireFeature()` middleware and frontend permission checks.
 */
export const Feature = {
  STARQ: "starq",
  BACK_TO_SCHOOL: "back-to-school",
  MONTHLY_FORECAST: "monthly-forecast",
  CONFIRMED_BID_ITEMS: "confirmed-bid-items",
  BID_EXPORT: "bid-export",
  PROMPT_BUILDER: "prompt-builder",
  STOCKIQ_SYNC: "stockiq-sync",
  CUSTOMER_BIDS_SYNC: "customer-bids-sync",
  EO_RISK_REVIEW: "eo-risk-review",
} as const;

export type Feature = (typeof Feature)[keyof typeof Feature];

// import { CUSTOMER_BID_SERVICE_TOKEN } from "@/services/ICustomerBidService";

/**
 * Feature Constants
 *
 * Each feature maps to a frontend page/section and its backing API routes.
 * Used by both `requireFeature()` middleware and frontend permission checks.
 */
export const Feature = {
  STARQ: "starq",
  DEMAND_VALIDATION_TOOL: "demand-validation-tool",
  MONTHLY_FORECAST: "monthly-forecast",
  CONFIRMED_BID_ITEMS: "confirmed-bid-items",
  BID_EXPORT: "bid-export",
  PROMPT_BUILDER: "prompt-builder",
  STOCKIQ_SYNC: "stockiq-sync",
  CUSTOMER_BIDS_SYNC: "customer-bids-sync",
  EO_DASHBOARD: "eo-dashboard",
  EO_RISK_REVIEW: "eo-risk-review",
  EO_ACTIONS: "eo-actions",
  EO_DISPOSITION: "eo-disposition",
  RBAC_ADMIN: "rbac-admin",
  BID_EXPORT_WEBHOOK: "bid-export-webhook",
  CUSTOMER_PERFORMANCE: "customer-performance",
} as const;

export type Feature = (typeof Feature)[keyof typeof Feature];

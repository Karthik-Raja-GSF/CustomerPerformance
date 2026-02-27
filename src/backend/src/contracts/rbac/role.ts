/**
 * Role Constants
 *
 * Maps to Azure AD group membership. Each role is resolved from
 * the user's `custom:groups` SAML claim via environment-configured GUIDs.
 */
export const Role = {
  SALES: "SALES",
  CATMAN: "CATMAN",
  DEMAND_PLANNER: "DEMAND_PLANNER",
  PURCHASING: "PURCHASING",
  EARLY_ADOPTER: "EARLY_ADOPTER",
  ADMIN: "ADMIN",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

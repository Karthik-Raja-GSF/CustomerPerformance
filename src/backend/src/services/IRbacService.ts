import type { UserAccessDto } from "@/contracts/dtos/rbac.dto";

/**
 * RBAC Service Interface
 *
 * Resolves user Azure AD groups into roles and features.
 * When RBAC is disabled, all methods return full access.
 */
export const RBAC_SERVICE_TOKEN = Symbol.for("IRbacService");

export interface IRbacService {
  /**
   * Resolve user's Azure AD group GUIDs into matched roles
   */
  resolveRoles(
    userGroups: string[]
  ): { enumKey: string; displayName: string }[];

  /**
   * Resolve user's Azure AD group GUIDs into the union of all matched roles' features
   */
  resolveFeatures(userGroups: string[]): string[];

  /**
   * Check if a user has access to a specific feature
   */
  hasFeature(userGroups: string[], feature: string): boolean;

  /**
   * Get full user access DTO for the API response
   */
  getUserAccess(userGroups: string[]): UserAccessDto;
}

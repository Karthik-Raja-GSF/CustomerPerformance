import type { UserAccessDto } from "@/contracts/dtos/rbac.dto";

/**
 * RBAC Service Interface
 *
 * Resolves user Azure AD groups into roles and features using database-backed
 * group definitions. When RBAC is disabled, all methods return full access.
 */
export const RBAC_SERVICE_TOKEN = Symbol.for("IRbacService");

export interface IRbacService {
  /**
   * Resolve user's Azure AD group GUIDs into matched groups (as roles)
   */
  resolveRoles(
    userGroups: string[]
  ): Promise<{ enumKey: string; displayName: string }[]>;

  /**
   * Resolve user's Azure AD group GUIDs into the union of all matched groups' features
   */
  resolveFeatures(userGroups: string[]): Promise<string[]>;

  /**
   * Check if a user has access to a specific feature
   */
  hasFeature(userGroups: string[], feature: string): Promise<boolean>;

  /**
   * Get full user access DTO for the API response
   */
  getUserAccess(userGroups: string[]): Promise<UserAccessDto>;

  /**
   * Clear the in-memory cache. Called after admin mutations.
   */
  clearCache(): void;
}

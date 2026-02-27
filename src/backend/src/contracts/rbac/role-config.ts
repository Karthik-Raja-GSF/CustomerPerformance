import type { Role } from "./role";
import type { Feature } from "./feature";

/**
 * Role Definition
 *
 * Maps an Azure AD group GUID (environment-specific) to a role enum key
 * and the features that role can access.
 */
export interface RoleDefinition {
  enumKey: Role;
  displayName: string;
  groupId: string;
  features: Feature[];
}

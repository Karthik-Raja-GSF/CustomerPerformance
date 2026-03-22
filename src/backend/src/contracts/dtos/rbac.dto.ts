/**
 * User Access DTO
 *
 * Returned by GET /auth/access. Contains the user's resolved roles
 * and features based on their Azure AD group membership.
 */
export interface UserAccessDto {
  enabled: boolean;
  roles: { enumKey: string; displayName: string }[];
  features: string[];
}

/**
 * RBAC Admin DTOs
 *
 * Used by the RBAC admin routes for group management.
 */
export interface RbacGroupDto {
  id: string;
  key: string;
  displayName: string;
  azureAdGroupId: string;
  description: string | null;
  features: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRbacGroupDto {
  key: string;
  displayName: string;
  azureAdGroupId?: string;
  description?: string;
}

export interface UpdateRbacGroupDto {
  displayName?: string;
  azureAdGroupId?: string;
  description?: string;
}

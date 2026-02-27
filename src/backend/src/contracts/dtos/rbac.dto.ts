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

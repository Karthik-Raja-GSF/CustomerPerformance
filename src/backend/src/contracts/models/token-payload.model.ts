/**
 * Token Payload Model
 *
 * Represents the decoded JWT token payload from Cognito.
 */
export interface TokenPayload {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  iat: number;
  exp: number;
}

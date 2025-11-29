import { TokenPayload } from '@/contracts/models/token-payload.model';

/**
 * Token Service Interface
 *
 * Defines the contract for token verification services.
 */
export const TOKEN_SERVICE_TOKEN = Symbol.for('ITokenService');

export interface ITokenService {
  /**
   * Verify a JWT token and return the decoded payload
   * @param token - The JWT token string to verify
   * @returns Promise resolving to the decoded token payload
   * @throws AuthenticationError if token is invalid
   * @throws TokenExpiredError if token has expired
   */
  verifyToken(token: string): Promise<TokenPayload>;
}

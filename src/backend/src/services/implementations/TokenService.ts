import { injectable } from 'tsyringe';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { ITokenService } from '@/services/ITokenService';
import { TokenPayload } from '@/contracts/models/token-payload.model';
import {
  TokenExpiredError,
  InvalidTokenError,
} from '@/utils/errors/auth-errors';

/**
 * Token Service Implementation
 *
 * Verifies JWT tokens from AWS Cognito.
 */
@injectable()
export class TokenService implements ITokenService {
  private readonly cognitoVerifier: ReturnType<typeof CognitoJwtVerifier.create>;

  constructor() {
    const userPoolId = process.env.AWS_COGNITO_USER_POOL_ID;
    const clientId = process.env.AWS_COGNITO_CLIENT_ID;

    if (!userPoolId || !clientId) {
      throw new Error(
        'AWS_COGNITO_USER_POOL_ID and AWS_COGNITO_CLIENT_ID must be set'
      );
    }

    this.cognitoVerifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: 'id',
      clientId,
    });
  }

  /**
   * Verify token and return payload
   */
  async verifyToken(token: string): Promise<TokenPayload> {
    try {
      const payload = await this.cognitoVerifier.verify(token);
      return this.parseCognitoPayload(payload);
    } catch (error: unknown) {
      const err = error as Error & { name?: string; message?: string };

      if (err.name === 'JwtExpiredError' || err.message?.includes('expired')) {
        throw new TokenExpiredError('Cognito token has expired');
      }

      throw new InvalidTokenError(`Invalid Cognito token: ${err.message}`);
    }
  }

  /**
   * Parse Cognito JWT payload to TokenPayload
   */
  private parseCognitoPayload(cognitoPayload: Record<string, unknown>): TokenPayload {
    const userId = cognitoPayload.sub as string;
    const email = cognitoPayload.email as string;
    const firstName = (cognitoPayload.given_name as string) || '';
    const lastName = (cognitoPayload.family_name as string) || '';
    const iat = cognitoPayload.iat as number;
    const exp = cognitoPayload.exp as number;

    if (!userId || !email) {
      throw new InvalidTokenError('Cognito token missing required claims (sub, email)');
    }

    return {
      userId,
      email,
      firstName,
      lastName,
      iat,
      exp,
    };
  }
}

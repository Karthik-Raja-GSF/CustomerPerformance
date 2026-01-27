import { injectable } from "tsyringe";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { ITokenService } from "@/services/ITokenService";
import {
  TokenPayload,
  FederatedIdentity,
} from "@/contracts/models/token-payload.model";
import {
  TokenExpiredError,
  InvalidTokenError,
} from "@/utils/errors/auth-errors";

/**
 * Token Service Implementation
 *
 * Verifies JWT tokens from AWS Cognito.
 */
@injectable()
export class TokenService implements ITokenService {
  private readonly cognitoVerifier: ReturnType<
    typeof CognitoJwtVerifier.create
  >;

  constructor() {
    const userPoolId = process.env.AWS_COGNITO_USER_POOL_ID;
    const clientId = process.env.AWS_COGNITO_CLIENT_ID;

    if (!userPoolId || !clientId) {
      throw new Error(
        "AWS_COGNITO_USER_POOL_ID and AWS_COGNITO_CLIENT_ID must be set"
      );
    }

    this.cognitoVerifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: "id",
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
      const err = error as Error;

      if (err.name === "JwtExpiredError" || err.message?.includes("expired")) {
        throw new TokenExpiredError("Cognito token has expired");
      }

      throw new InvalidTokenError(`Invalid Cognito token: ${err.message}`);
    }
  }

  /**
   * Parse Cognito JWT payload to TokenPayload
   */
  private parseCognitoPayload(
    cognitoPayload: Record<string, unknown>
  ): TokenPayload {
    // Standard claims
    const userId = cognitoPayload.sub as string;
    const email = cognitoPayload.email as string;
    const firstName = (cognitoPayload.given_name as string) || "";
    const lastName = (cognitoPayload.family_name as string) || "";
    const iat = cognitoPayload.iat as number;
    const exp = cognitoPayload.exp as number;

    // Federated user detection
    const identitiesRaw = cognitoPayload.identities as string | undefined;
    const cognitoUsername = cognitoPayload["cognito:username"] as
      | string
      | undefined;
    const idpEmail = cognitoPayload["custom:idp_email"] as string | undefined;

    // Parse identities JSON to detect federated users
    let isFederated = false;
    let federatedProvider: string | undefined;
    let federatedProviderType: string | undefined;

    if (identitiesRaw) {
      try {
        const identities = JSON.parse(identitiesRaw) as FederatedIdentity[];
        const primaryIdentity = identities[0];
        if (primaryIdentity) {
          isFederated = true;
          federatedProvider = primaryIdentity.providerName;
          federatedProviderType = primaryIdentity.providerType;
        }
      } catch {
        // Invalid JSON, treat as non-federated
      }
    }

    if (!userId || !email) {
      throw new InvalidTokenError(
        "Cognito token missing required claims (sub, email)"
      );
    }

    return {
      userId,
      email,
      firstName,
      lastName,
      iat,
      exp,
      isFederated,
      federatedProvider,
      federatedProviderType,
      idpEmail,
      cognitoUsername,
    };
  }
}

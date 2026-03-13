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

    const svcUserPoolId = process.env.AWS_COGNITO_SVC_USER_POOL_ID;
    const svcClientId = process.env.AWS_COGNITO_SVC_CLIENT_ID;

    const pools: {
      userPoolId: string;
      tokenUse: "id";
      clientId: string;
    }[] = [{ userPoolId, tokenUse: "id", clientId }];

    if (svcUserPoolId && svcClientId) {
      pools.push({
        userPoolId: svcUserPoolId,
        tokenUse: "id",
        clientId: svcClientId,
      });
    }

    this.cognitoVerifier = CognitoJwtVerifier.create(pools);
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

      throw new InvalidTokenError("Invalid authentication token");
    }
  }

  /**
   * Sanitize a string claim: strip tab/newline characters and trim whitespace
   */
  private sanitize(value: string | undefined): string {
    if (!value) return "";
    return value.replace(/[\t\r\n]/g, " ").trim();
  }

  /**
   * Parse a comma-separated or single-value string into a string array
   */
  private parseGroupsClaim(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(String);
    const str = String(value).trim();
    if (!str) return [];
    return str
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);
  }

  /**
   * Parse Cognito JWT payload to TokenPayload
   */
  private parseCognitoPayload(
    cognitoPayload: Record<string, unknown>
  ): TokenPayload {
    // Standard claims (sanitized)
    const userId = cognitoPayload.sub as string;
    const email =
      this.sanitize(cognitoPayload.email as string) ||
      this.sanitize(cognitoPayload["custom:email"] as string) ||
      "";
    const firstName = this.sanitize(cognitoPayload.given_name as string);
    const lastName = this.sanitize(cognitoPayload.family_name as string);
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
        const identities = (
          typeof identitiesRaw === "string"
            ? JSON.parse(identitiesRaw)
            : identitiesRaw
        ) as FederatedIdentity[];
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

    // Azure AD groups & roles (from SAML custom attributes)
    const groups = this.parseGroupsClaim(cognitoPayload["custom:groups"]);
    const role =
      this.sanitize(cognitoPayload["custom:role"] as string) || undefined;

    // Cognito-internal groups (includes IdP auto-group)
    const cognitoGroups = Array.isArray(cognitoPayload["cognito:groups"])
      ? (cognitoPayload["cognito:groups"] as string[])
      : [];

    if (!userId) {
      throw new InvalidTokenError("Cognito token missing required claim (sub)");
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
      groups,
      role,
      cognitoGroups,
    };
  }
}

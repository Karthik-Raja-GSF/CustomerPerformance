/**
 * Federated Identity from Cognito identities claim
 *
 * Present when user authenticated via external IdP (SAML, OIDC, etc.)
 */
export interface FederatedIdentity {
  userId: string;
  providerName: string;
  providerType: string;
  issuer?: string;
  primary: boolean;
  dateCreated: number;
}

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

  // Federated user fields
  isFederated: boolean;
  federatedProvider?: string;
  federatedProviderType?: string;
  idpEmail?: string;
  cognitoUsername?: string;

  // Azure AD groups & roles (from SAML custom attributes)
  groups: string[];
  role?: string;
  // Cognito-internal groups (includes IdP auto-group)
  cognitoGroups: string[];
}

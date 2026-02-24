import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
  CognitoIdToken,
} from "amazon-cognito-identity-js";
import { cognitoConfig } from "@/config/cognito";

/**
 * Cognito Authentication Error
 */
export class CognitoAuthError extends Error {
  code: string;
  originalError?: Error;

  constructor(message: string, code: string, originalError?: Error) {
    super(message);
    this.name = "CognitoAuthError";
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * User info extracted from Cognito ID token
 */
export interface CognitoUserInfo {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  groups: string[];
  role?: string;
}

/**
 * Auth result with tokens and user info
 */
export interface CognitoAuthResult {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: CognitoUserInfo;
}

// Initialize the User Pool (lazy initialization)
let userPool: CognitoUserPool | null = null;

// Store pending password challenge context
let pendingPasswordChallenge: {
  cognitoUser: CognitoUser;
  userAttributes: Record<string, string>;
  email: string;
} | null = null;

/**
 * Get pending password challenge info (if any)
 */
export function getPendingPasswordChallenge() {
  return pendingPasswordChallenge;
}

/**
 * Clear pending password challenge
 */
export function clearPendingPasswordChallenge() {
  pendingPasswordChallenge = null;
}

function getUserPool(): CognitoUserPool {
  if (!userPool) {
    if (!cognitoConfig.userPoolId || !cognitoConfig.clientId) {
      throw new CognitoAuthError(
        "Cognito is not configured. Set VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID.",
        "ConfigurationError"
      );
    }
    userPool = new CognitoUserPool({
      UserPoolId: cognitoConfig.userPoolId,
      ClientId: cognitoConfig.clientId,
    } as const);
  }
  return userPool;
}

/**
 * Extract first/last name from email as fallback when SAML claims are missing
 * Handles formats: "firstname.lastname@domain", "firstname_lastname@domain", "username@domain"
 */
function extractNameFromEmail(email: string): {
  firstName: string;
  lastName: string;
} {
  const localPart = email.split("@")[0] || "";
  // Handle formats: "firstname.lastname", "firstname_lastname"
  const [first, ...rest] = localPart.split(/[._]/);
  const last = rest.at(-1);

  if (first && last) {
    return {
      firstName: first.charAt(0).toUpperCase() + first.slice(1).toLowerCase(),
      lastName: last.charAt(0).toUpperCase() + last.slice(1).toLowerCase(),
    };
  }

  // Single name fallback
  if (localPart) {
    return {
      firstName:
        localPart.charAt(0).toUpperCase() + localPart.slice(1).toLowerCase(),
      lastName: "",
    };
  }

  return { firstName: "", lastName: "" };
}

/**
 * Sanitize a string claim: strip tab/newline characters and trim whitespace
 */
function sanitize(value: unknown): string {
  if (!value || typeof value !== "string") return "";
  return value.replace(/[\t\r\n]/g, " ").trim();
}

/**
 * Parse groups from a custom:groups claim (comma-separated string or array)
 */
function parseGroups(value: unknown): string[] {
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
 * Extract user info from a raw JWT payload object
 */
function extractUserFromPayload(
  payload: Record<string, unknown>
): CognitoUserInfo {
  const email =
    sanitize(payload.email) || sanitize(payload["custom:email"]) || "";
  const fallbackName = extractNameFromEmail(email);

  return {
    userId: payload.sub as string,
    email,
    firstName:
      sanitize(payload.given_name) ||
      sanitize(payload["custom:firstName"]) ||
      fallbackName.firstName,
    lastName:
      sanitize(payload.family_name) ||
      sanitize(payload["custom:lastName"]) ||
      fallbackName.lastName,
    groups: parseGroups(payload["custom:groups"]),
    role: sanitize(payload["custom:role"]) || undefined,
  };
}

/**
 * Extract user info from Cognito ID token
 */
function extractUserFromIdToken(idToken: CognitoIdToken): CognitoUserInfo {
  return extractUserFromPayload(idToken.payload as Record<string, unknown>);
}

/**
 * Calculate token expiration in seconds
 */
function getExpiresIn(session: CognitoUserSession): number {
  const expirationTime = session.getIdToken().getExpiration();
  const currentTime = Math.floor(Date.now() / 1000);
  return Math.max(0, expirationTime - currentTime);
}

/**
 * Sign in with email and password
 */
export function signIn(
  email: string,
  password: string
): Promise<CognitoAuthResult> {
  return new Promise((resolve, reject) => {
    try {
      const pool = getUserPool();

      const authDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      });

      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: pool,
      });

      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (session: CognitoUserSession) => {
          const idToken = session.getIdToken();
          const user = extractUserFromIdToken(idToken);

          resolve({
            idToken: idToken.getJwtToken(),
            accessToken: session.getAccessToken().getJwtToken(),
            refreshToken: session.getRefreshToken().getToken(),
            expiresIn: getExpiresIn(session),
            user,
          });
        },
        onFailure: (err: Error) => {
          const error = err as Error & { code?: string };
          let message = "Authentication failed";

          switch (error.code) {
            case "UserNotFoundException":
              message = "User not found";
              break;
            case "NotAuthorizedException":
              message = "Incorrect email or password";
              break;
            case "UserNotConfirmedException":
              message = "User not confirmed";
              break;
            case "PasswordResetRequiredException":
              message = "Password reset required";
              break;
            case "InvalidParameterException":
              message = "Invalid parameters";
              break;
            default:
              message = error.message || "Authentication error";
          }

          reject(
            new CognitoAuthError(message, error.code || "UnknownError", err)
          );
        },
        newPasswordRequired: (userAttributes: Record<string, string>) => {
          // Store the challenge context for later use
          pendingPasswordChallenge = {
            cognitoUser,
            userAttributes,
            email,
          };
          reject(
            new CognitoAuthError(
              "New password required",
              "NewPasswordRequired",
              new Error(JSON.stringify(userAttributes))
            )
          );
        },
      });
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

/**
 * Refresh tokens for federated users via Cognito OAuth endpoint
 * Used when getCurrentUser() returns null (federated/OAuth users)
 */
async function refreshWithOAuthEndpoint(
  refreshToken: string
): Promise<CognitoAuthResult> {
  const { domain, clientId } = cognitoConfig;

  if (!domain) {
    throw new CognitoAuthError(
      "Cognito domain not configured",
      "ConfigurationError"
    );
  }

  const response = await fetch(`https://${domain}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new CognitoAuthError(
      `Token refresh failed: ${errorText}`,
      "TokenRefreshFailed"
    );
  }

  const tokens = (await response.json()) as CognitoTokenResponse;
  const idTokenPayload = parseJwtPayload(tokens.id_token);

  // Store the new refresh token if provided
  if (tokens.refresh_token) {
    localStorage.setItem("refresh_token", tokens.refresh_token);
  }

  return {
    idToken: tokens.id_token,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || refreshToken,
    expiresIn: tokens.expires_in,
    user: extractUserFromPayload(idTokenPayload),
  };
}

/**
 * Refresh the current session
 * For native Cognito users: Uses SDK refresh
 * For federated users: Uses OAuth token endpoint with stored refresh token
 */
export function refreshSession(): Promise<CognitoAuthResult> {
  return new Promise((resolve, reject) => {
    try {
      const pool = getUserPool();
      const cognitoUser = pool.getCurrentUser();

      // For federated users, getCurrentUser() returns null
      // Try OAuth refresh if we have a stored refresh token
      if (!cognitoUser) {
        const storedRefreshToken = localStorage.getItem("refresh_token");
        if (storedRefreshToken) {
          refreshWithOAuthEndpoint(storedRefreshToken)
            .then(resolve)
            .catch(reject);
          return;
        }
        reject(new CognitoAuthError("No session found", "NoCurrentUser"));
        return;
      }

      cognitoUser.getSession(
        (err: Error | null, session: CognitoUserSession | null) => {
          if (err || !session) {
            reject(
              new CognitoAuthError(
                "Failed to get session",
                "SessionError",
                err || undefined
              )
            );
            return;
          }

          // Always force refresh to get new tokens
          cognitoUser.refreshSession(
            session.getRefreshToken(),
            (
              refreshErr: Error | null,
              newSession: CognitoUserSession | null
            ) => {
              if (refreshErr || !newSession) {
                reject(
                  new CognitoAuthError(
                    "Failed to refresh token",
                    "TokenRefreshFailed",
                    refreshErr instanceof Error ? refreshErr : undefined
                  )
                );
                return;
              }

              const idToken = newSession.getIdToken();
              const user = extractUserFromIdToken(idToken);

              resolve({
                idToken: idToken.getJwtToken(),
                accessToken: newSession.getAccessToken().getJwtToken(),
                refreshToken: newSession.getRefreshToken().getToken(),
                expiresIn: getExpiresIn(newSession),
                user,
              });
            }
          );
        }
      );
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

/**
 * Get the current session if valid
 * For OAuth/federated users: Restore from localStorage tokens
 * For native Cognito users: Use Cognito SDK session
 */
export function getCurrentSession(): Promise<CognitoAuthResult | null> {
  return new Promise((resolve) => {
    try {
      // First, check localStorage for tokens (OAuth/federated users)
      const storedIdToken = localStorage.getItem("id_token");
      const storedAccessToken = localStorage.getItem("access_token");

      if (storedIdToken && storedAccessToken) {
        try {
          // Validate token is not expired
          const payload = parseJwtPayload(storedIdToken);
          const exp = payload.exp as number;
          const now = Math.floor(Date.now() / 1000);

          if (exp > now) {
            // Token is still valid, restore session from localStorage
            resolve({
              idToken: storedIdToken,
              accessToken: storedAccessToken,
              refreshToken: "", // OAuth doesn't store refresh token in localStorage
              expiresIn: exp - now,
              user: extractUserFromPayload(payload),
            });
            return;
          }
        } catch {
          // Token parsing failed, continue to Cognito SDK fallback
        }
      }

      // Fall back to Cognito SDK for native users
      const pool = getUserPool();
      const cognitoUser = pool.getCurrentUser();

      if (!cognitoUser) {
        resolve(null);
        return;
      }

      cognitoUser.getSession(
        (err: Error | null, session: CognitoUserSession | null) => {
          if (err || !session || !session.isValid()) {
            resolve(null);
            return;
          }

          const idToken = session.getIdToken();
          const user = extractUserFromIdToken(idToken);

          resolve({
            idToken: idToken.getJwtToken(),
            accessToken: session.getAccessToken().getJwtToken(),
            refreshToken: session.getRefreshToken().getToken(),
            expiresIn: getExpiresIn(session),
            user,
          });
        }
      );
    } catch {
      // Config not set, no session
      resolve(null);
    }
  });
}

/**
 * Sign out the current user
 */
export function signOut(): void {
  try {
    const pool = getUserPool();
    const cognitoUser = pool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }
  } catch {
    // Config not set, nothing to sign out
  }
}

/**
 * Global sign out (invalidates all sessions)
 */
export function globalSignOut(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const pool = getUserPool();
      const cognitoUser = pool.getCurrentUser();

      if (!cognitoUser) {
        resolve();
        return;
      }

      cognitoUser.getSession(
        (err: Error | null, session: CognitoUserSession | null) => {
          if (err || !session) {
            // Even if we can't get session, try to sign out locally
            cognitoUser.signOut();
            resolve();
            return;
          }

          cognitoUser.globalSignOut({
            onSuccess: () => {
              resolve();
            },
            onFailure: (signOutErr) => {
              // Sign out locally even if global sign out fails
              cognitoUser.signOut();
              reject(
                new CognitoAuthError(
                  "Global sign out error",
                  "GlobalSignOutFailed",
                  signOutErr
                )
              );
            },
          });
        }
      );
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

/**
 * Complete new password challenge for first-time users
 */
export function completeNewPasswordChallenge(
  newPassword: string
): Promise<CognitoAuthResult> {
  return new Promise((resolve, reject) => {
    if (!pendingPasswordChallenge) {
      reject(
        new CognitoAuthError(
          "No pending password change request",
          "NoPendingChallenge"
        )
      );
      return;
    }

    const { cognitoUser, userAttributes, email } = pendingPasswordChallenge;

    // Remove attributes that Cognito doesn't allow to be sent back
    const filteredAttributes: Record<string, string> = {};
    const allowedAttributes = ["given_name", "family_name", "name"];

    for (const key of allowedAttributes) {
      if (userAttributes[key]) {
        filteredAttributes[key] = userAttributes[key];
      }
    }

    // Ensure required attributes have values (use email prefix as fallback for names)
    if (!filteredAttributes.given_name) {
      filteredAttributes.given_name = email.split("@")[0] || "User";
    }
    if (!filteredAttributes.family_name) {
      filteredAttributes.family_name = email.split("@")[0] || "User";
    }

    cognitoUser.completeNewPasswordChallenge(newPassword, filteredAttributes, {
      onSuccess: (session: CognitoUserSession) => {
        // Clear the pending challenge
        pendingPasswordChallenge = null;

        const idToken = session.getIdToken();
        const user = extractUserFromIdToken(idToken);

        resolve({
          idToken: idToken.getJwtToken(),
          accessToken: session.getAccessToken().getJwtToken(),
          refreshToken: session.getRefreshToken().getToken(),
          expiresIn: getExpiresIn(session),
          user,
        });
      },
      onFailure: (err: Error) => {
        const error = err as Error & { code?: string };
        let message = "Failed to change password";

        switch (error.code) {
          case "InvalidPasswordException":
            message = "Password does not meet security requirements";
            break;
          case "InvalidParameterException":
            message = "Invalid parameters";
            break;
          default:
            message = error.message || "Password change error";
        }

        reject(
          new CognitoAuthError(message, error.code || "UnknownError", err)
        );
      },
    });
  });
}

/**
 * Change password for currently authenticated user
 */
export function changePassword(
  oldPassword: string,
  newPassword: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const pool = getUserPool();
      const cognitoUser = pool.getCurrentUser();

      if (!cognitoUser) {
        reject(new CognitoAuthError("No session found", "NoCurrentUser"));
        return;
      }

      cognitoUser.getSession(
        (err: Error | null, session: CognitoUserSession | null) => {
          if (err || !session) {
            reject(
              new CognitoAuthError(
                "Failed to get session",
                "SessionError",
                err || undefined
              )
            );
            return;
          }

          // Helper function to perform the password change
          const performPasswordChange = () => {
            cognitoUser.changePassword(
              oldPassword,
              newPassword,
              (changeErr) => {
                if (changeErr) {
                  const error = changeErr as Error & { code?: string };
                  let message = "Failed to change password";

                  switch (error.code) {
                    case "InvalidPasswordException":
                      message =
                        "New password does not meet security requirements";
                      break;
                    case "NotAuthorizedException":
                      message = "Incorrect current password";
                      break;
                    case "LimitExceededException":
                      message = "Too many attempts. Please try again later";
                      break;
                    default:
                      message = error.message || "Password change error";
                  }

                  reject(
                    new CognitoAuthError(
                      message,
                      error.code || "UnknownError",
                      changeErr
                    )
                  );
                  return;
                }

                resolve();
              }
            );
          };

          // Check if session is valid, refresh if needed
          if (!session.isValid()) {
            cognitoUser.refreshSession(
              session.getRefreshToken(),
              (
                refreshErr: Error | null,
                newSession: CognitoUserSession | null
              ) => {
                if (refreshErr || !newSession) {
                  reject(
                    new CognitoAuthError(
                      "Session expired. Please log in again",
                      "SessionExpired",
                      refreshErr instanceof Error ? refreshErr : undefined
                    )
                  );
                  return;
                }
                performPasswordChange();
              }
            );
          } else {
            performPasswordChange();
          }
        }
      );
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

// ============================================================================
// Federated Sign-In (Azure AD via Cognito Hosted UI)
// ============================================================================

/**
 * Redirect to Cognito Hosted UI for federated sign-in with Entra ID (Azure AD)
 *
 * This initiates the OAuth 2.0 Authorization Code flow:
 * 1. User is redirected to Cognito Hosted UI
 * 2. Cognito redirects to Entra ID for authentication
 * 3. After Entra ID auth, user is redirected back with authorization code
 */
export function federatedSignIn(): void {
  const { domain, clientId, azureAdIdpName } = cognitoConfig;

  if (!domain) {
    throw new CognitoAuthError(
      "Cognito domain not configured. Set VITE_COGNITO_DOMAIN.",
      "ConfigurationError"
    );
  }

  if (!azureAdIdpName) {
    throw new CognitoAuthError(
      "Azure AD IdP name not configured. Set VITE_COGNITO_AZURE_AD_IDP_NAME.",
      "ConfigurationError"
    );
  }

  const redirectUri = `${window.location.origin}/auth/callback`;

  // Build Cognito Hosted UI authorization URL
  const url = new URL(`https://${domain}/oauth2/authorize`);
  url.searchParams.set("identity_provider", azureAdIdpName);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "openid email profile");
  // Force Azure AD to always prompt for credentials (no SSO auto-login)
  url.searchParams.set("prompt", "login");

  // Redirect to Cognito Hosted UI
  window.location.href = url.toString();
}

/**
 * Token response from Cognito OAuth token endpoint
 */
interface CognitoTokenResponse {
  id_token: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * Parse JWT token payload without verification (client-side only)
 */
function parseJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) {
    throw new CognitoAuthError("Invalid JWT token format", "InvalidToken");
  }
  const base64Url = parts[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
  return JSON.parse(jsonPayload) as Record<string, unknown>;
}

/**
 * Exchange authorization code for tokens after OAuth callback
 *
 * This completes the OAuth 2.0 Authorization Code flow by exchanging
 * the authorization code for Cognito tokens.
 */
export async function handleAuthCallback(
  code: string
): Promise<CognitoAuthResult> {
  const { domain, clientId } = cognitoConfig;

  if (!domain) {
    throw new CognitoAuthError(
      "Cognito domain not configured. Set VITE_COGNITO_DOMAIN.",
      "ConfigurationError"
    );
  }

  const redirectUri = `${window.location.origin}/auth/callback`;

  // Exchange authorization code for tokens
  const response = await fetch(`https://${domain}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new CognitoAuthError(
      `Token exchange failed: ${errorText}`,
      "TokenExchangeFailed"
    );
  }

  const tokens = (await response.json()) as CognitoTokenResponse;

  // Parse ID token to extract user information
  const idTokenPayload = parseJwtPayload(tokens.id_token);

  return {
    idToken: tokens.id_token,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in,
    user: extractUserFromPayload(idTokenPayload),
  };
}

/**
 * Check if current user was authenticated via federated identity (Azure AD/Entra ID)
 * Federated users have an 'identities' claim in their ID token from the SAML provider
 */
export function isFederatedUser(): boolean {
  try {
    const idToken = localStorage.getItem("id_token");
    if (!idToken) return false;

    const payload = parseJwtPayload(idToken);
    // Federated users have 'identities' claim from SAML/OIDC provider
    return Array.isArray(payload.identities) && payload.identities.length > 0;
  } catch {
    return false;
  }
}

/**
 * Sign out via Cognito logout endpoint, then Azure AD logout (for federated users)
 * This ends both Cognito Hosted UI session and Azure AD SSO session
 *
 * Flow:
 * 1. Clear local tokens and Cognito SDK storage
 * 2. Set flag for Login page to know we need Azure AD logout
 * 3. Redirect to Cognito logout endpoint (clears Hosted UI session cookies)
 * 4. Cognito redirects to /login with sso_logout param
 * 5. Login page detects param and redirects to Azure AD logout
 * 6. Azure AD ends session and redirects back to /login
 */
export function federatedSignOutFull(): void {
  const { domain, clientId } = cognitoConfig;

  // Clear local tokens and Cognito SDK storage
  signOut();

  // Redirect to Cognito logout endpoint to clear Hosted UI session
  // Add sso_logout param so Login page knows to redirect to Azure AD logout
  const logoutUri = `${window.location.origin}/login?sso_logout=1`;
  const cognitoLogoutUrl = new URL(`https://${domain}/logout`);
  cognitoLogoutUrl.searchParams.set("client_id", clientId);
  cognitoLogoutUrl.searchParams.set("logout_uri", logoutUri);

  window.location.href = cognitoLogoutUrl.toString();
}

/**
 * Redirect to Azure AD logout endpoint
 * Called from Login page after Cognito logout completes
 */
export function azureAdLogout(): void {
  const { azureAdTenantId } = cognitoConfig;

  const finalRedirectUri = `${window.location.origin}/login`;
  const azureLogoutUrl = new URL(
    `https://login.microsoftonline.com/${azureAdTenantId}/oauth2/v2.0/logout`
  );
  azureLogoutUrl.searchParams.set("post_logout_redirect_uri", finalRedirectUri);

  window.location.href = azureLogoutUrl.toString();
}

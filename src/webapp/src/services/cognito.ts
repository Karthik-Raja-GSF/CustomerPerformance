import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
  CognitoIdToken,
} from 'amazon-cognito-identity-js';
import { cognitoConfig } from '@/config/cognito';

/**
 * Cognito Authentication Error
 */
export class CognitoAuthError extends Error {
  code: string;
  originalError?: Error;

  constructor(message: string, code: string, originalError?: Error) {
    super(message);
    this.name = 'CognitoAuthError';
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
        'Cognito is not configured. Set VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID.',
        'ConfigurationError'
      );
    }
    userPool = new CognitoUserPool({
      UserPoolId: cognitoConfig.userPoolId,
      ClientId: cognitoConfig.clientId,
    });
  }
  return userPool;
}

/**
 * Extract user info from Cognito ID token
 */
function extractUserFromIdToken(idToken: CognitoIdToken): CognitoUserInfo {
  const payload = idToken.payload;

  return {
    userId: payload.sub as string,
    email: (payload.email as string) || (payload['custom:email'] as string) || '',
    firstName: (payload.given_name as string) || (payload['custom:firstName'] as string) || '',
    lastName: (payload.family_name as string) || (payload['custom:lastName'] as string) || '',
  };
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
export function signIn(email: string, password: string): Promise<CognitoAuthResult> {
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
          let message = 'Authentication failed';

          switch (error.code) {
            case 'UserNotFoundException':
              message = 'User not found';
              break;
            case 'NotAuthorizedException':
              message = 'Incorrect email or password';
              break;
            case 'UserNotConfirmedException':
              message = 'User not confirmed';
              break;
            case 'PasswordResetRequiredException':
              message = 'Password reset required';
              break;
            case 'InvalidParameterException':
              message = 'Invalid parameters';
              break;
            default:
              message = error.message || 'Authentication error';
          }

          reject(new CognitoAuthError(message, error.code || 'UnknownError', err));
        },
        newPasswordRequired: (userAttributes) => {
          // Store the challenge context for later use
          pendingPasswordChallenge = {
            cognitoUser,
            userAttributes,
            email,
          };
          reject(new CognitoAuthError(
            'New password required',
            'NewPasswordRequired',
            new Error(JSON.stringify(userAttributes))
          ));
        },
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Refresh the current session
 */
export function refreshSession(): Promise<CognitoAuthResult> {
  return new Promise((resolve, reject) => {
    try {
      const pool = getUserPool();
      const cognitoUser = pool.getCurrentUser();

      if (!cognitoUser) {
        reject(new CognitoAuthError('No session found', 'NoCurrentUser'));
        return;
      }

      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session) {
          reject(new CognitoAuthError(
            'Failed to get session',
            'SessionError',
            err || undefined
          ));
          return;
        }

        // Always force refresh to get new tokens
        cognitoUser.refreshSession(session.getRefreshToken(), (refreshErr, newSession) => {
          if (refreshErr || !newSession) {
            reject(new CognitoAuthError(
              'Failed to refresh token',
              'TokenRefreshFailed',
              refreshErr
            ));
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
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get the current session if valid
 */
export function getCurrentSession(): Promise<CognitoAuthResult | null> {
  return new Promise((resolve) => {
    try {
      const pool = getUserPool();
      const cognitoUser = pool.getCurrentUser();

      if (!cognitoUser) {
        resolve(null);
        return;
      }

      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
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
      });
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

      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session) {
          // Even if we can't get session, try to sign out locally
          cognitoUser.signOut();
          resolve();
          return;
        }

        cognitoUser.globalSignOut({
          onSuccess: () => resolve(),
          onFailure: (signOutErr) => {
            // Sign out locally even if global sign out fails
            cognitoUser.signOut();
            reject(new CognitoAuthError(
              'Global sign out error',
              'GlobalSignOutFailed',
              signOutErr
            ));
          },
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Complete new password challenge for first-time users
 */
export function completeNewPasswordChallenge(newPassword: string): Promise<CognitoAuthResult> {
  return new Promise((resolve, reject) => {
    if (!pendingPasswordChallenge) {
      reject(new CognitoAuthError(
        'No pending password change request',
        'NoPendingChallenge'
      ));
      return;
    }

    const { cognitoUser, userAttributes, email } = pendingPasswordChallenge;

    // Remove attributes that Cognito doesn't allow to be sent back
    const filteredAttributes: Record<string, string> = {};
    const allowedAttributes = ['given_name', 'family_name', 'name'];

    for (const key of allowedAttributes) {
      if (userAttributes[key]) {
        filteredAttributes[key] = userAttributes[key];
      }
    }

    // Ensure required attributes have values (use email prefix as fallback for names)
    if (!filteredAttributes.given_name) {
      filteredAttributes.given_name = email.split('@')[0] || 'User';
    }
    if (!filteredAttributes.family_name) {
      filteredAttributes.family_name = email.split('@')[0] || 'User';
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
        let message = 'Failed to change password';

        switch (error.code) {
          case 'InvalidPasswordException':
            message = 'Password does not meet security requirements';
            break;
          case 'InvalidParameterException':
            message = 'Invalid parameters';
            break;
          default:
            message = error.message || 'Password change error';
        }

        reject(new CognitoAuthError(message, error.code || 'UnknownError', err));
      },
    });
  });
}

/**
 * Change password for currently authenticated user
 */
export function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const pool = getUserPool();
      const cognitoUser = pool.getCurrentUser();

      if (!cognitoUser) {
        reject(new CognitoAuthError('No session found', 'NoCurrentUser'));
        return;
      }

      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session) {
          reject(new CognitoAuthError(
            'Failed to get session',
            'SessionError',
            err || undefined
          ));
          return;
        }

        // Helper function to perform the password change
        const performPasswordChange = () => {
          cognitoUser.changePassword(oldPassword, newPassword, (changeErr) => {
            if (changeErr) {
              const error = changeErr as Error & { code?: string };
              let message = 'Failed to change password';

              switch (error.code) {
                case 'InvalidPasswordException':
                  message = 'New password does not meet security requirements';
                  break;
                case 'NotAuthorizedException':
                  message = 'Incorrect current password';
                  break;
                case 'LimitExceededException':
                  message = 'Too many attempts. Please try again later';
                  break;
                default:
                  message = error.message || 'Password change error';
              }

              reject(new CognitoAuthError(message, error.code || 'UnknownError', changeErr));
              return;
            }

            resolve();
          });
        };

        // Check if session is valid, refresh if needed
        if (!session.isValid()) {
          cognitoUser.refreshSession(session.getRefreshToken(), (refreshErr, newSession) => {
            if (refreshErr || !newSession) {
              reject(new CognitoAuthError(
                'Session expired. Please log in again',
                'SessionExpired',
                refreshErr
              ));
              return;
            }
            performPasswordChange();
          });
        } else {
          performPasswordChange();
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

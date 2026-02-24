import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { AuthResponse, LoginCredentials, AuthUser } from "@/types/auth.types";
import { apiClient } from "@/apis/client";
import {
  signIn as cognitoSignIn,
  signOut as cognitoSignOut,
  refreshSession as cognitoRefreshSession,
  getCurrentSession,
  changePassword as cognitoChangePassword,
  CognitoAuthError,
  CognitoAuthResult,
  federatedSignOutFull,
  isFederatedUser,
} from "@/services/cognito";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  extendSession: () => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  setAuthFromCognitoResult: (result: CognitoAuthResult) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Token storage keys
const TOKEN_KEY = "access_token";
const ID_TOKEN_KEY = "id_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const REFRESH_THRESHOLD = 5 * 60 * 1000; // Refresh 5 minutes before expiry

interface AuthProviderProps {
  children: React.ReactNode;
  onLogin?: (authResponse: AuthResponse) => void;
  onRefresh?: (authResponse: AuthResponse) => void;
  onLogout?: () => void;
}

/**
 * Convert Cognito auth result to our AuthResponse format
 */
function toAuthResponse(result: CognitoAuthResult): AuthResponse {
  return {
    idToken: result.idToken,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresIn: result.expiresIn,
    user: {
      userId: result.user.userId,
      email: result.user.email,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      groups: result.user.groups,
      role: result.user.role,
    },
  };
}

export function AuthProvider({
  children,
  onLogin,
  onRefresh,
  onLogout,
}: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<number | null>(null);
  const refreshTokenRef = useRef<(() => Promise<void>) | null>(null);

  /**
   * Store tokens in localStorage for API client access
   */
  const storeTokens = useCallback((authResponse: AuthResponse) => {
    localStorage.setItem(TOKEN_KEY, authResponse.accessToken);
    localStorage.setItem(ID_TOKEN_KEY, authResponse.idToken);
    if (authResponse.refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, authResponse.refreshToken);
    }
  }, []);

  /**
   * Clear tokens from localStorage
   */
  const clearTokens = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ID_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }, []);

  /**
   * Schedule automatic token refresh before expiry
   */
  const scheduleTokenRefresh = useCallback((expiresIn: number) => {
    // Clear existing timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    // Calculate when to refresh (5 minutes before expiry)
    const refreshIn = Math.max(expiresIn * 1000 - REFRESH_THRESHOLD, 0);

    console.log(
      `Token refresh scheduled in ${Math.round(refreshIn / 1000 / 60)} minutes`
    );

    refreshTimerRef.current = window.setTimeout(() => {
      // Use ref to call the latest version of refreshToken
      void refreshTokenRef.current?.();
    }, refreshIn);
  }, []); // No dependency on refreshToken - uses ref instead

  /**
   * Set authentication data from auth response
   */
  const setAuthData = useCallback(
    (authResponse: AuthResponse) => {
      storeTokens(authResponse);
      setUser(authResponse.user);
      scheduleTokenRefresh(authResponse.expiresIn);
    },
    [storeTokens, scheduleTokenRefresh]
  );

  /**
   * Login user via Cognito
   */
  const login = useCallback(
    async (credentials: LoginCredentials) => {
      try {
        setIsLoading(true);

        // Call Cognito directly
        const result = await cognitoSignIn(
          credentials.email,
          credentials.password
        );
        const authResponse = toAuthResponse(result);

        setAuthData(authResponse);
        onLogin?.(authResponse);
      } catch (error) {
        console.error("Login error:", error);
        if (error instanceof CognitoAuthError) {
          throw new Error(error.message);
        }
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [setAuthData, onLogin]
  );

  /**
   * Refresh access token via Cognito
   */
  const refreshToken = useCallback(async () => {
    try {
      const result = await cognitoRefreshSession();
      const authResponse = toAuthResponse(result);

      setAuthData(authResponse);
      onRefresh?.(authResponse);
    } catch (error) {
      console.error("Token refresh error:", error);
      logout();
      throw error;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- logout called via closure intentionally to avoid circular dependency
  }, [setAuthData, onRefresh]);

  /**
   * Keep refreshToken ref updated so scheduled timeout always calls latest version
   */
  useEffect(() => {
    refreshTokenRef.current = refreshToken;
  }, [refreshToken]);

  /**
   * Extend session - alias for refreshToken for explicit user action
   */
  const extendSession = useCallback(async () => {
    await refreshToken();
  }, [refreshToken]);

  /**
   * Set auth data from Cognito result (used for password challenge completion)
   */
  const setAuthFromCognitoResult = useCallback(
    (result: CognitoAuthResult) => {
      const authResponse = toAuthResponse(result);
      setAuthData(authResponse);
      onLogin?.(authResponse);
    },
    [setAuthData, onLogin]
  );

  /**
   * Change password for authenticated user
   */
  const changePassword = useCallback(
    async (oldPassword: string, newPassword: string) => {
      try {
        await cognitoChangePassword(oldPassword, newPassword);
      } catch (error) {
        if (error instanceof CognitoAuthError) {
          throw new Error(error.message);
        }
        throw error;
      }
    },
    []
  );

  /**
   * Logout user
   * For federated users (Azure AD SSO), redirects to Cognito logout to end SSO session
   * For native Cognito users, just clears local session
   */
  const logout = useCallback(() => {
    // Check if user is federated before clearing tokens (need id_token for check)
    const isFederated = isFederatedUser();

    // Clear refresh timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    // Clear our tokens
    clearTokens();

    // Clear user data
    setUser(null);

    // Trigger callback
    onLogout?.();

    // For federated users, redirect to Cognito + Azure AD logout to end SSO session
    if (isFederated) {
      federatedSignOutFull();
    } else {
      // For native Cognito users, just clear Cognito SDK storage
      cognitoSignOut();
    }
  }, [clearTokens, onLogout]);

  /**
   * Set up API client refresh token callback on mount
   */
  useEffect(() => {
    apiClient.setRefreshTokenCallback(refreshToken);
  }, [refreshToken]);

  /**
   * Initialize auth state on mount
   */
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Try to get current session from Cognito
        const session = await getCurrentSession();

        if (session) {
          const authResponse = toAuthResponse(session);
          setAuthData(authResponse);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        // Clear any stale tokens
        clearTokens();
      } finally {
        setIsLoading(false);
      }
    };

    void initAuth();

    // Cleanup timer on unmount
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [setAuthData, clearTokens]);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refreshToken,
    extendSession,
    changePassword,
    setAuthFromCognitoResult,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

/**
 * Get current access token (for API calls)
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Get current ID token (contains user claims)
 */
export function getIdToken(): string | null {
  return localStorage.getItem(ID_TOKEN_KEY);
}

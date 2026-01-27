import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { handleAuthCallback, CognitoAuthError } from "@/services/cognito";

/**
 * OAuth Callback Page
 *
 * Handles the redirect from Cognito Hosted UI after Azure AD authentication.
 * Exchanges the authorization code for tokens and completes the login flow.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuthFromCognitoResult } = useAuth();
  const [error, setError] = useState<string | null>(null);
  // Prevent double execution in React 18 Strict Mode (OAuth codes are single-use)
  const processedRef = useRef(false);

  useEffect(() => {
    // Guard against double execution - OAuth codes can only be used once
    if (processedRef.current) {
      return;
    }
    processedRef.current = true;

    const processCallback = async () => {
      // Extract authorization code from URL
      const code = searchParams.get("code");
      const errorParam = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      // Handle OAuth error response
      if (errorParam) {
        setError(errorDescription || errorParam);
        return;
      }

      // Validate authorization code
      if (!code) {
        setError("No authorization code received");
        return;
      }

      try {
        // Exchange code for tokens
        const result = await handleAuthCallback(code);

        // Set authentication state
        setAuthFromCognitoResult(result);

        // Navigate to home page
        void navigate("/", { replace: true });
      } catch (err) {
        console.error("Auth callback error:", err);
        if (err instanceof CognitoAuthError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Authentication failed");
        }
      }
    };

    void processCallback();
  }, [searchParams, setAuthFromCognitoResult, navigate]);

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4 p-8 max-w-md">
          <div className="text-red-500 text-lg font-semibold">
            Authentication Failed
          </div>
          <p className="text-sm" style={{ color: "#6b7280" }}>
            {error}
          </p>
          <button
            onClick={() => navigate("/login", { replace: true })}
            className="px-4 py-2 text-sm font-medium rounded-md"
            style={{
              backgroundColor: "#539D4C",
              color: "white",
            }}
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  // Show loading state
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto" />
        <p className="text-sm" style={{ color: "#6b7280" }}>
          Completing sign in...
        </p>
      </div>
    </div>
  );
}

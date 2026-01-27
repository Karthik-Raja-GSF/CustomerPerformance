import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/shadcn/components/button";
import { Input } from "@/shadcn/components/input";
import { Label } from "@/shadcn/components/label";
import {
  CognitoAuthError,
  federatedSignIn,
  azureAdLogout,
} from "@/services/cognito";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Handle SSO logout redirect chain
  // After Cognito logout, we land here with sso_logout=1, then redirect to Azure AD logout
  useEffect(() => {
    const ssoLogout = searchParams.get("sso_logout");
    if (ssoLogout === "1") {
      // Redirect to Azure AD logout to clear SSO session
      azureAdLogout();
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login({ email, password });
      void navigate("/");
    } catch (err) {
      if (err instanceof Error) {
        // Check for new password required
        if (
          err.message === "New password required" ||
          (err instanceof CognitoAuthError &&
            err.code === "NewPasswordRequired")
        ) {
          void navigate("/force-change-password");
          return;
        }
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Hero Image (70%) */}
      <div
        className="w-[70%] hidden md:block relative"
        style={{
          backgroundImage: "url(/gs-foods-hero.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Glass overlay with logo */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center">
          <img
            src="https://gsfoodsgroup.com/wp-content/uploads/2020/09/GSFoodsGroup_Logo_White-optimized.png"
            alt="GS Foods Group"
            className="h-[28rem] w-auto"
          />
        </div>
      </div>

      {/* Right side - Sign In Form (30%) */}
      <div
        className="w-[30%] flex items-center justify-center p-8"
        style={{ backgroundColor: "#fff" }}
      >
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold">Sign In</h1>
            <p className="text-sm" style={{ color: "#6b7280" }}>
              Enter your credentials to access your account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
                required
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              style={{ backgroundColor: "#539D4C", borderColor: "#539D4C" }}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span
                  className="w-full border-t"
                  style={{ borderColor: "#e5e7eb" }}
                />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span
                  className="px-2"
                  style={{ backgroundColor: "#fff", color: "#6b7280" }}
                >
                  Or continue with
                </span>
              </div>
            </div>

            {/* Microsoft Sign-In Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isLoading}
              onClick={() => federatedSignIn()}
            >
              <svg
                className="mr-2 h-4 w-4"
                viewBox="0 0 21 21"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
              </svg>
              Sign in with Microsoft
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

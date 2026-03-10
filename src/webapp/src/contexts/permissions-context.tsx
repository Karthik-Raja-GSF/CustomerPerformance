import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useAuth } from "@/contexts/auth-context";
import { fetchUserAccess } from "@/apis/permissions";
import type { Feature } from "@/config/features";

interface PermissionsContextValue {
  roles: { enumKey: string; displayName: string }[];
  features: string[];
  hasFeature: (feature: Feature) => boolean;
  isLoading: boolean;
}

const PermissionsContext = createContext<PermissionsContextValue | undefined>(
  undefined
);

export function PermissionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated } = useAuth();
  const [roles, setRoles] = useState<
    { enumKey: string; displayName: string }[]
  >([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setRoles([]);
      setFeatures([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const loadAccess = async () => {
      try {
        setIsLoading(true);
        const access = await fetchUserAccess();
        if (!cancelled) {
          setRoles(access.roles ?? []);
          setFeatures(access.features ?? []);
        }
      } catch (error) {
        console.error("Failed to fetch user access:", error);
        if (!cancelled) {
          setRoles([]);
          setFeatures([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadAccess();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user]);

  const hasFeature = useCallback(
    (feature: Feature): boolean => {
      return features.includes(feature);
    },
    [features]
  );

  const value: PermissionsContextValue = {
    roles,
    features,
    hasFeature,
    isLoading,
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions(): PermissionsContextValue {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error("usePermissions must be used within PermissionsProvider");
  }
  return context;
}

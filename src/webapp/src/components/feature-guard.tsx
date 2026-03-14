import { Navigate, useLocation } from "react-router-dom";
import { usePermissions } from "@/contexts/permissions-context";
import { Feature } from "@/config/features";

/** Maps each feature to its primary route — used to find the first accessible page. */
const featureRouteMap: Record<string, string> = {
  [Feature.STARQ]: "/",
  [Feature.DEMAND_VALIDATION_TOOL]: "/sales-insights/demand-validation-tool",
  [Feature.MONTHLY_FORECAST]: "/demand-planning/monthly-forecast",
  [Feature.CONFIRMED_BID_ITEMS]: "/demand-planning/confirmed-bid-items",
  [Feature.BID_EXPORT]: "/bid-export-history",
  [Feature.PROMPT_BUILDER]: "/settings",
  [Feature.STOCKIQ_SYNC]: "/stockiq-sync",
  [Feature.CUSTOMER_BIDS_SYNC]: "/customer-bids-sync",
  [Feature.EO_RISK_REVIEW]: "/eo/risk-review",
};

interface FeatureGuardProps {
  children: React.ReactNode;
  feature: Feature;
  fallbackPath?: string;
}

/**
 * Route-level feature guard.
 * - Redirects to fallbackPath (or first accessible route) if user lacks the required feature.
 * - Shows "Access Denied" when the user has zero features (Catman/Purchasing).
 */
export function FeatureGuard({
  children,
  feature,
  fallbackPath = "/",
}: FeatureGuardProps) {
  const { features, hasFeature, isLoading } = usePermissions();
  const location = useLocation();

  if (isLoading) {
    return null;
  }

  if (!hasFeature(feature)) {
    // No features at all → show access denied (avoids redirect loop)
    if (features.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <h1 className="text-2xl font-semibold">Access Denied</h1>
          <p className="text-muted-foreground text-center max-w-md">
            Your account does not have access to any features. Please contact
            your administrator to request access.
          </p>
        </div>
      );
    }

    // Find the first route the user CAN access (avoids redirect-to-self loop)
    let target = fallbackPath;
    if (target === location.pathname) {
      const firstAccessible = features.find((f) => f in featureRouteMap);
      target =
        (firstAccessible && featureRouteMap[firstAccessible]) ?? fallbackPath;
    }

    // If target is still the current path, show access denied to prevent loop
    if (target === location.pathname) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <h1 className="text-2xl font-semibold">Access Denied</h1>
          <p className="text-muted-foreground text-center max-w-md">
            You do not have access to this page.
          </p>
        </div>
      );
    }

    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
}

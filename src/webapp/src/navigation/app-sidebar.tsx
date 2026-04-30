import * as React from "react";
import {
  Settings2,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Users2,
} from "lucide-react";
import { Feature } from "@/config/features";
import { usePermissions } from "@/contexts/permissions-context";

import { Branding } from "@/navigation/branding";
import { NavMain } from "@/navigation/nav-main";
import { NavUser } from "@/navigation/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/shadcn/components/sidebar";

// Navigation data with feature requirements
const data = {
  navMain: [
    // {
    //   title: "StarQ",
    //   url: "/",
    //   icon: StarqIcon,
    //   feature: Feature.STARQ,
    //   badge: "Beta",
    // },
    {
      title: "Sales Insights",
      url: "/sales-insights/demand-validation-tool",
      icon: BarChart3,
      items: [
        {
          title: "Demand Validation Tool",
          url: "/sales-insights/demand-validation-tool",
          feature: Feature.DEMAND_VALIDATION_TOOL,
        },
      ],
    },
    {
      title: "Customer Performance",
      url: "/customer-performance",
      icon: Users2,
      items: [
        {
          title: "Demand Validation Tool",
          url: "/customer-performance/dashboard",
          feature: Feature.CUSTOMER_PERFORMANCE_DASHBOARD,
        },
        {
          title: "Customer Performance",
          url: "/customer-performance/performance",
          feature: Feature.CUSTOMER_PERFORMANCE,
        },
      ],
    },
    {
      title: "Demand Planning",
      url: "/demand-planning/monthly-forecast",
      icon: TrendingUp,
      items: [
        {
          title: "Monthly Forecast",
          url: "/demand-planning/monthly-forecast",
          feature: Feature.MONTHLY_FORECAST,
        },
        {
          title: "Confirmed Bid Items",
          url: "/demand-planning/confirmed-bid-items",
          feature: Feature.CONFIRMED_BID_ITEMS,
        },
      ],
    },
    {
      title: "E&O",
      url: "/eo/dashboard",
      icon: AlertTriangle,
      items: [
        {
          title: "Dashboard",
          url: "/eo/dashboard",
          feature: Feature.EO_DASHBOARD,
        },
        {
          title: "Risk Review",
          url: "/eo/risk-review",
          feature: Feature.EO_RISK_REVIEW,
        },
        {
          title: "Actions",
          url: "/eo/actions",
          feature: Feature.EO_ACTIONS,
        },
        {
          title: "Disposition",
          url: "/eo/disposition",
          feature: Feature.EO_DISPOSITION,
        },
      ],
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings2,
      isActive: true,
      items: [
        {
          title: "Prompt Builder",
          url: "/settings",
          feature: Feature.PROMPT_BUILDER,
        },
        {
          title: "StockIQ Sync",
          url: "/stockiq-sync",
          feature: Feature.STOCKIQ_SYNC,
        },
        {
          title: "Customer Bids Sync",
          url: "/customer-bids-sync",
          feature: Feature.CUSTOMER_BIDS_SYNC,
        },
        {
          title: "Bid Items Export History",
          url: "/bid-export-history",
          feature: Feature.BID_EXPORT,
        },
        {
          title: "Access Control",
          url: "/settings/rbac",
          feature: Feature.RBAC_ADMIN,
        },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { hasFeature } = usePermissions();

  // Filter nav items based on user's feature access
  const filteredNavMain = data.navMain
    .map((item) => {
      // For items with sub-items, filter the sub-items first
      if (item.items) {
        const filteredSubItems = item.items.filter((sub) =>
          hasFeature(sub.feature)
        );
        // Hide parent if no sub-items remain
        if (filteredSubItems.length === 0) return null;
        return { ...item, items: filteredSubItems };
      }
      // For top-level items with a feature requirement
      if (item.feature && !hasFeature(item.feature)) {
        return null;
      }
      return item;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <Branding />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={filteredNavMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

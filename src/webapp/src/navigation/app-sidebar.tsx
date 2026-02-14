import * as React from "react";
import { Settings2, GraduationCap, TrendingUp } from "lucide-react";
import { StarqIcon } from "@/components/icons/starq-icon";

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

// Navigation data
const data = {
  navMain: [
    {
      title: "StarQ",
      url: "/",
      icon: StarqIcon,
    },
    {
      title: "Back to School",
      url: "/back-to-school",
      icon: GraduationCap,
    },
    {
      title: "Demand Planning",
      url: "/demand-planning/monthly-forecast",
      icon: TrendingUp,
      items: [
        {
          title: "Monthly Forecast",
          url: "/demand-planning/monthly-forecast",
        },
        {
          title: "Confirmed Bid Items",
          url: "/demand-planning/confirmed-bid-items",
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
        },
        {
          title: "StockIQ Sync",
          url: "/stockiq-sync",
        },
        {
          title: "Customer Bids Sync",
          url: "/customer-bids-sync",
        },
        {
          title: "Bid Items Export History",
          url: "/bid-export-history",
        },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <Branding />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

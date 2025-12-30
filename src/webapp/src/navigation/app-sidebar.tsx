import * as React from "react";
import { Settings2 } from "lucide-react";
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
      title: "Settings",
      url: "/settings",
      icon: Settings2,
      isActive: true,
      items: [
        {
          title: "Prompt Builder",
          url: "/settings",
        },
        // TODO: SIQ Import temporarily disabled
        // {
        //   title: "SIQ Import",
        //   url: "/siq-import",
        // },
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

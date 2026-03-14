import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/shadcn/components/sidebar";

const LOGO_URL = "/GoldStarFoods_Logo.svg";

export function Branding() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg">
          <div className="bg-sidebar-primary flex aspect-square size-8 items-center justify-center rounded-lg">
            <img src={LOGO_URL} alt="Gold Star Foods" className="size-6" />
          </div>
          <div className="grid flex-1 text-left leading-tight">
            <span className="truncate font-semibold text-sidebar-foreground">
              Gold Star Foods
            </span>
            <span className="truncate text-xs text-sidebar-foreground/70">
              Demand Planning & Procurement
            </span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

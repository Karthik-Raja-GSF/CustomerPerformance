import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/shadcn/components/sidebar"

const LOGO_URL =
  "https://gsfoodsgroup.com/wp-content/uploads/2020/09/GSFoodsGroup_Logo_White-optimized.png"

export function Branding() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg">
          <div className="bg-sidebar-primary flex aspect-square size-8 items-center justify-center rounded-lg">
            <img src={LOGO_URL} alt="GS Foods Group" className="size-5" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">Gold Star Foods</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

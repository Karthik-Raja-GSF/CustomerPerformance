import { AppSidebar } from "@/navigation/app-sidebar"
import { SiteHeader } from "@/navigation/site-header"
import { SidebarInset, SidebarProvider } from "@/shadcn/components/sidebar"

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="!h-svh !max-h-svh overflow-hidden">
      <AppSidebar />
      <SidebarInset className="overflow-hidden">
        <SiteHeader />
        <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

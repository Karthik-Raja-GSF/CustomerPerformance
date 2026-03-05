import { useEffect, useState } from "react";
import { AppSidebar } from "@/navigation/app-sidebar";
import { SiteHeader } from "@/navigation/site-header";
import { SidebarInset, SidebarProvider } from "@/shadcn/components/sidebar";

const COLLAPSE_BREAKPOINT = 1280;

export default function Layout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(
    () => window.innerWidth >= COLLAPSE_BREAKPOINT
  );

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${COLLAPSE_BREAKPOINT}px)`);
    const onChange = (e: MediaQueryListEvent) => setOpen(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return (
    <SidebarProvider
      className="!h-svh !max-h-svh overflow-hidden"
      open={open}
      onOpenChange={setOpen}
    >
      <AppSidebar />
      <SidebarInset className="overflow-hidden">
        <SiteHeader />
        <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

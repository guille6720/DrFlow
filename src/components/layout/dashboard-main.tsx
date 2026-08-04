"use client";

import { cn } from "@/lib/utils/cn";
import { useDashboardSidebar } from "@/components/layout/dashboard-sidebar-context";

export function DashboardMain({ children }: { children: React.ReactNode }) {
  const { hidden } = useDashboardSidebar();

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={cn(
        "transition-[padding] duration-200 ease-out outline-none",
        hidden ? "lg:pl-0" : "lg:pl-64"
      )}
    >
      {children}
    </main>
  );
}

"use client";

import { useDashboardSidebar } from "@/core/components/layout/dashboard-sidebar-context";

import { cn } from "@/shared/utils/cn";

export function DashboardMain({ children }: { children: React.ReactNode }) {
  const { hidden } = useDashboardSidebar();

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={cn(
        "drflow-app-main flex min-h-0 flex-1 flex-col transition-[padding] duration-200 ease-out outline-none",
        hidden ? "lg:pl-0" : "lg:pl-64"
      )}
    >
      {children}
    </main>
  );
}

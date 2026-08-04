"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/shared/utils/cn";
import type { UserRole } from "@/types/database";
import { hasPermission } from "@/core/permissions/roles";
import { useDashboardSidebar } from "@/core/components/layout/dashboard-sidebar-context";
import { NAV_PLUGIN_BY_FEATURE } from "@/plugins/registry";
import { filterNavByPlugins } from "@/plugins/resolve";
import { NAV_FLAG_BY_HREF } from "@/features/flags/lib/registry";
import { filterNavByFeatureFlags } from "@/features/flags/lib/resolve";
import { useClinicFeatures } from "@/features/plugins/components/plugins/clinic-plugins-provider";
import {
  Menu,
  SidebarNavContent,
  X,
} from "@/core/components/layout/sidebar-nav-content";
import { SIDEBAR_NAV_ITEMS } from "@/core/components/layout/sidebar-nav-config";
export { FEATURE_NAV_ITEMS } from "@/features/_shared/nav";

interface SidebarProps {
  clinicName?: string;
  role: UserRole | null;
  isSuperadmin?: boolean;
}

export function Sidebar({ clinicName, role, isSuperadmin }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { hidden: desktopHidden, toggleHidden } = useDashboardSidebar();
  const clinicFeatures = useClinicFeatures();

  const visibleItems = filterNavByFeatureFlags(
    filterNavByPlugins(
      SIDEBAR_NAV_ITEMS.filter((item) => {
        if (!item.permission) return true;
        return hasPermission(role, item.permission, isSuperadmin);
      }),
      clinicFeatures.plugins,
      NAV_PLUGIN_BY_FEATURE
    ),
    clinicFeatures,
    NAV_FLAG_BY_HREF
  );

  function handleToggleSidebarHidden() {
    toggleHidden();
    setMobileOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className="fixed left-4 top-4 z-50 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-500 p-2.5 text-white shadow-lg shadow-cyan-500/30 lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
        aria-expanded={mobileOpen}
        aria-controls="drflow-sidebar"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Cerrar menú de navegación"
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        id="drflow-sidebar"
        aria-label="Menú lateral"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r drflow-ui-sidebar drflow-sidebar-gradient shadow-xl shadow-black/30 transition-transform duration-200 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          desktopHidden ? "lg:-translate-x-full" : "lg:translate-x-0"
        )}
      >
        <SidebarNavContent
          clinicName={clinicName}
          visibleItems={visibleItems}
          pathname={pathname}
          onNavigate={() => setMobileOpen(false)}
          onPrefetch={(href) => router.prefetch(href)}
          sidebarHidden={desktopHidden}
          onToggleSidebarHidden={handleToggleSidebarHidden}
        />
      </aside>
    </>
  );
}

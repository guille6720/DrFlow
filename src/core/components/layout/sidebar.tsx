"use client";

import { Menu, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { useDashboardSidebar } from "@/core/components/layout/dashboard-sidebar-context";
import {
  isSidebarNavGroup,
  SIDEBAR_NAV_ENTRIES,
  type SidebarNavEntry,
  type SidebarNavLink,
} from "@/core/components/layout/sidebar-nav-config";
import { SidebarNavContent } from "@/core/components/layout/sidebar-nav-content";
import { canAccessImportExport, hasPermission, isInvitedClinicMember, type PermissionOverrides } from "@/core/permissions/roles";

import { cn } from "@/shared/utils/cn";

import { NAV_FLAG_BY_HREF } from "@/features/flags/lib/registry";
import { isFeatureFlagEnabled } from "@/features/flags/lib/resolve";
import { useClinicFeatures } from "@/features/plugins/components/plugins/clinic-features-provider";

import { NAV_PLUGIN_BY_FEATURE } from "@/plugins/registry";
import { isPluginEnabled } from "@/plugins/resolve";
import type { UserRole } from "@/types/database";

export { FEATURE_NAV_ITEMS } from "@/features/_shared/nav";

interface SidebarProps {
  clinicId?: string | null;
  clinicName?: string;
  role: UserRole | null;
  isSuperadmin?: boolean;
  permissionOverrides?: PermissionOverrides;
}

function filterNavLink(
  item: SidebarNavLink,
  role: UserRole | null,
  isSuperadmin: boolean | undefined,
  clinicFeatures: ReturnType<typeof useClinicFeatures>,
  permissionOverrides?: PermissionOverrides
): boolean {
  if (item.href === "/datos") {
    return canAccessImportExport(role, isSuperadmin ?? false, permissionOverrides);
  }

  if (
    item.permission &&
    !hasPermission(role, item.permission, isSuperadmin, permissionOverrides)
  ) {
    return false;
  }

  const pluginId = NAV_PLUGIN_BY_FEATURE[item.featureId];
  if (pluginId && !isPluginEnabled(clinicFeatures.plugins, pluginId)) {
    return false;
  }

  const flagId = NAV_FLAG_BY_HREF[item.href];
  if (flagId && !isFeatureFlagEnabled(clinicFeatures, flagId)) {
    return false;
  }

  return true;
}

function filterSidebarNavEntries(
  entries: SidebarNavEntry[],
  role: UserRole | null,
  isSuperadmin: boolean | undefined,
  clinicFeatures: ReturnType<typeof useClinicFeatures>,
  permissionOverrides?: PermissionOverrides
): SidebarNavEntry[] {
  return entries
    .map((entry) => {
      if (isSidebarNavGroup(entry)) {
        const children = entry.children.filter((child) =>
          filterNavLink(child, role, isSuperadmin, clinicFeatures, permissionOverrides)
        );
        if (children.length === 0) return null;
        return { ...entry, children };
      }

      return filterNavLink(entry, role, isSuperadmin, clinicFeatures, permissionOverrides)
        ? entry
        : null;
    })
    .filter((entry): entry is SidebarNavEntry => entry != null);
}

export function Sidebar({
  clinicId,
  clinicName,
  role,
  isSuperadmin,
  permissionOverrides,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { hidden: desktopHidden, toggleHidden } = useDashboardSidebar();
  const clinicFeatures = useClinicFeatures();

  const visibleItems = useMemo(
    () =>
      filterSidebarNavEntries(
        SIDEBAR_NAV_ENTRIES,
        role,
        isSuperadmin,
        clinicFeatures,
        permissionOverrides
      ),
    [role, isSuperadmin, clinicFeatures, permissionOverrides]
  );

  const isInvitedMember = isInvitedClinicMember(role, isSuperadmin);

  const prefetchHref = useCallback(
    (href: string) => {
      router.prefetch(href);
    },
    [router]
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
          clinicId={clinicId}
          clinicName={clinicName}
          visibleItems={visibleItems}
          pathname={pathname}
          onNavigate={() => setMobileOpen(false)}
          onPrefetch={prefetchHref}
          sidebarHidden={desktopHidden}
          onToggleSidebarHidden={handleToggleSidebarHidden}
          isInvitedMember={isInvitedMember}
        />
      </aside>
    </>
  );
}

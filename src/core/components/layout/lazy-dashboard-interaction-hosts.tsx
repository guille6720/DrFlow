"use client";

import { RoutePrefetcher } from "@/core/components/layout/route-prefetcher";
import { safeClientDynamic } from "@/core/components/layout/safe-client-dynamic";

import type { UserRole } from "@/types/database";

const ClinicalContextMenuHost = safeClientDynamic(() =>
  import("@/features/ia/components/clinical-workflow/clinical-context-menu").then((mod) => ({
    default: mod.ClinicalContextMenuHost,
  }))
);

const ClinicalWorkflowShortcuts = safeClientDynamic(() =>
  import("@/features/ia/components/clinical-workflow/clinical-workflow-shortcuts").then((mod) => ({
    default: mod.ClinicalWorkflowShortcuts,
  }))
);

/** Non-critical dashboard interactions — deferred to reduce first-load JS. */
export function LazyDashboardInteractionHosts({
  role,
  isSuperadmin,
}: {
  role?: UserRole | null;
  isSuperadmin?: boolean;
}) {
  return (
    <>
      <RoutePrefetcher role={role} isSuperadmin={isSuperadmin} />
      <ClinicalContextMenuHost />
      <ClinicalWorkflowShortcuts />
    </>
  );
}

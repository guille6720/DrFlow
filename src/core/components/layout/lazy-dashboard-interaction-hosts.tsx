"use client";

import { safeClientDynamic } from "@/core/components/layout/safe-client-dynamic";

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

const RoutePrefetcher = safeClientDynamic(() =>
  import("@/core/components/layout/route-prefetcher").then((mod) => ({
    default: mod.RoutePrefetcher,
  }))
);

/** Non-critical dashboard interactions — deferred to reduce first-load JS. */
export function LazyDashboardInteractionHosts() {
  return (
    <>
      <RoutePrefetcher />
      <ClinicalContextMenuHost />
      <ClinicalWorkflowShortcuts />
    </>
  );
}

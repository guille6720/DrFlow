"use client";

import dynamic from "next/dynamic";

const ClinicalContextMenuHost = dynamic(
  () =>
    import("@/features/ia/components/clinical-workflow/clinical-context-menu").then(
      (mod) => ({ default: mod.ClinicalContextMenuHost })
    ),
  { ssr: false }
);

const ClinicalWorkflowShortcuts = dynamic(
  () =>
    import("@/features/ia/components/clinical-workflow/clinical-workflow-shortcuts").then(
      (mod) => ({ default: mod.ClinicalWorkflowShortcuts })
    ),
  { ssr: false }
);

const FloatingActions = dynamic(
  () =>
    import("@/core/components/layout/floating-actions").then((mod) => ({
      default: mod.FloatingActions,
    })),
  { ssr: false }
);

const RoutePrefetcher = dynamic(
  () =>
    import("@/core/components/layout/route-prefetcher").then((mod) => ({
      default: mod.RoutePrefetcher,
    })),
  { ssr: false }
);

/** Non-critical dashboard interactions — deferred to reduce first-load JS. */
export function LazyDashboardInteractionHosts() {
  return (
    <>
      <RoutePrefetcher />
      <ClinicalContextMenuHost />
      <ClinicalWorkflowShortcuts />
      <FloatingActions />
    </>
  );
}

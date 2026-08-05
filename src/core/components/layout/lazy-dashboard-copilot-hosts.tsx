"use client";

import dynamic from "next/dynamic";

const ClinicalCopilotHost = dynamic(
  () =>
    import("@/features/ia/components/clinical-workflow/clinical-copilot-host").then(
      (mod) => ({ default: mod.ClinicalCopilotHost })
    ),
  { ssr: false }
);

const AdminOpsCopilotHost = dynamic(
  () =>
    import("@/features/ia/components/admin-ops/admin-ops-copilot-host").then(
      (mod) => ({ default: mod.AdminOpsCopilotHost })
    ),
  { ssr: false }
);

/** IA copilot overlays — lazy-loaded to keep dashboard layout JS lean. */
export function LazyDashboardCopilotHosts() {
  return (
    <>
      <ClinicalCopilotHost />
      <AdminOpsCopilotHost />
    </>
  );
}

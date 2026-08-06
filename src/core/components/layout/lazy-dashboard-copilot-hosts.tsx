"use client";

import { safeClientDynamic } from "@/core/components/layout/safe-client-dynamic";

const ClinicalCopilotHost = safeClientDynamic(() =>
  import("@/features/ia/components/clinical-workflow/clinical-copilot-host").then((mod) => ({
    default: mod.ClinicalCopilotHost,
  }))
);

const AdminOpsCopilotHost = safeClientDynamic(() =>
  import("@/features/ia/components/admin-ops/admin-ops-copilot-host").then((mod) => ({
    default: mod.AdminOpsCopilotHost,
  }))
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

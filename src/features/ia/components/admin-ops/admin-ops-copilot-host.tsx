"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { useAdminOpsCopilot } from "@/features/ia/components/admin-ops/admin-ops-copilot-context";
import { AdminOpsCopilotSheet } from "@/features/ia/components/admin-ops/admin-ops-copilot-sheet";
import { useFeatureFlag } from "@/features/plugins/components/plugins/clinic-features-provider";

/** Admin/ops copilot sheet host — trigger lives in UnifiedCopilotFab. */
export function AdminOpsCopilotHost() {
  const enabled = useFeatureFlag("admin_ops_assistant");
  const pathname = usePathname();
  const { session, open, setOpen } = useAdminOpsCopilot();

  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  if (!enabled) return null;

  return (
    <AdminOpsCopilotSheet open={open} onClose={() => setOpen(false)} context={session} />
  );
}

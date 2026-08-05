"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { useClinicalCopilot } from "@/features/ia/components/clinical-workflow/clinical-copilot-context";
import { ClinicalCopilotSheet } from "@/features/ia/components/clinical-workflow/clinical-copilot-sheet";
import { useFeatureFlag } from "@/features/plugins/components/plugins/clinic-features-provider";

/** Clinical copilot sheet host — trigger lives in UnifiedCopilotFab. */
export function ClinicalCopilotHost() {
  const enabled = useFeatureFlag("consultation_assistant");
  const pathname = usePathname();
  const { session, open, setOpen } = useClinicalCopilot();

  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  if (!enabled) return null;

  return (
    <ClinicalCopilotSheet open={open} onClose={() => setOpen(false)} context={session} />
  );
}

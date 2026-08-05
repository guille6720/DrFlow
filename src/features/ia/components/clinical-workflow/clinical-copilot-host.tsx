"use client";

import { MessageSquare } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { cn } from "@/shared/utils/cn";

import { useClinicalCopilot } from "@/features/ia/components/clinical-workflow/clinical-copilot-context";
import { ClinicalCopilotSheet } from "@/features/ia/components/clinical-workflow/clinical-copilot-sheet";
import { useFeatureFlag } from "@/features/plugins/components/plugins/clinic-features-provider";

/** Floating copilot trigger — available across dashboard when IA is enabled. */
export function ClinicalCopilotHost() {
  const enabled = useFeatureFlag("consultation_assistant");
  const pathname = usePathname();
  const { session, open, setOpen, toggle } = useClinicalCopilot();

  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Abrir copilot clínico"
        title="Copilot clínico"
        onClick={toggle}
        className={cn(
          "fixed bottom-6 left-6 z-50 flex h-12 w-12 items-center justify-center rounded-full",
          "bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/30",
          "hover:scale-105 active:scale-95"
        )}
      >
        <MessageSquare className="h-5 w-5" />
      </button>

      <ClinicalCopilotSheet open={open} onClose={() => setOpen(false)} context={session} />
    </>
  );
}

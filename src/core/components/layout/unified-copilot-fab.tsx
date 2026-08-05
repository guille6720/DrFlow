"use client";

import { Sparkles } from "lucide-react";

import { cn } from "@/shared/utils/cn";

import { useAdminOpsCopilot } from "@/features/ia/components/admin-ops/admin-ops-copilot-context";
import {
  GeminiWebAppFab,
  useGeminiFabVisible,
} from "@/features/ia/components/clinical-workflow/gemini-web-app-link";
import { useFeatureFlag } from "@/features/plugins/components/plugins/clinic-features-provider";

/** Floating IA entry: Gemini web (clinical) or admin ops copilot. */
export function UnifiedCopilotFab() {
  const clinicalEnabled = useFeatureFlag("consultation_assistant");
  const adminEnabled = useFeatureFlag("admin_ops_assistant");
  const geminiFabVisible = useGeminiFabVisible();
  const admin = useAdminOpsCopilot();

  if (geminiFabVisible && clinicalEnabled) {
    return <GeminiWebAppFab />;
  }

  if (!adminEnabled) return null;

  return (
    <button
      type="button"
      aria-label="Abrir asistente operativo"
      title="Abrir asistente operativo"
      onClick={() => admin.toggle()}
      className={cn(
        "fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full",
        "bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-lg shadow-teal-500/30",
        "hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
      )}
    >
      <Sparkles className="h-5 w-5" aria-hidden />
    </button>
  );
}

export function useCopilotFabVisible(): boolean {
  const clinicalEnabled = useFeatureFlag("consultation_assistant");
  const adminEnabled = useFeatureFlag("admin_ops_assistant");
  return clinicalEnabled || adminEnabled;
}

"use client";

import { Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";

import { cn } from "@/shared/utils/cn";

import { useAdminOpsCopilot } from "@/features/ia/components/admin-ops/admin-ops-copilot-context";
import { useClinicalCopilot } from "@/features/ia/components/clinical-workflow/clinical-copilot-context";
import { useFeatureFlag } from "@/features/plugins/components/plugins/clinic-features-provider";

function prefersClinicalCopilot(pathname: string): boolean {
  return (
    /^\/pacientes\/(?!nuevo)/.test(pathname) ||
    pathname.startsWith("/historias") ||
    pathname.startsWith("/recetas")
  );
}

/** Single floating entry point for IA assistants (clinical + admin/ops). */
export function UnifiedCopilotFab() {
  const pathname = usePathname();
  const clinicalEnabled = useFeatureFlag("consultation_assistant");
  const adminEnabled = useFeatureFlag("admin_ops_assistant");
  const clinical = useClinicalCopilot();
  const admin = useAdminOpsCopilot();

  if (!clinicalEnabled && !adminEnabled) return null;

  const mode =
    clinicalEnabled && (prefersClinicalCopilot(pathname) || !adminEnabled)
      ? "clinical"
      : adminEnabled
        ? "admin"
        : null;

  if (!mode) return null;

  const label =
    mode === "clinical" ? "Abrir copilot clínico" : "Abrir asistente operativo";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => (mode === "clinical" ? clinical.toggle() : admin.toggle())}
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

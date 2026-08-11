"use client";

import { Sparkles } from "lucide-react";
import dynamic from "next/dynamic";

import type { ClinicalOperationsDashboardPayload } from "@/features/dashboard/utils/clinical-operations-dashboard-types";
import { useAdminOpsCopilot } from "@/features/ia/components/admin-ops/admin-ops-copilot-context";
import { useFeatureFlag } from "@/features/plugins/components/plugins/clinic-features-provider";

import { Button } from "@/components/ui/button";

const ClinicalOpsAiRailInner = dynamic(
  () => import("./clinical-ops-ai-rail-inner").then((m) => m.ClinicalOpsAiRailInner),
  { ssr: false, loading: () => <AiRailSkeleton /> }
);

function AiRailSkeleton() {
  return (
    <aside className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 lg:sticky lg:top-4">
      <p className="text-sm text-slate-500">Cargando asistente…</p>
    </aside>
  );
}

type Props = {
  ops: ClinicalOperationsDashboardPayload;
};

export function ClinicalOpsAiRail({ ops }: Props) {
  const enabled = useFeatureFlag("admin_ops_assistant");
  const { toggle } = useAdminOpsCopilot();

  return (
    <aside
      aria-label="Asistente clínico"
      className="drflow-sticky-rail flex flex-col gap-3 rounded-xl border border-slate-700/60 bg-slate-900/40 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
          Asistente IA
        </h2>
        <Sparkles className="h-4 w-4 text-teal-400" aria-hidden />
      </div>

      <ClinicalOpsAiRailInner ops={ops} />

      <p className="text-[11px] leading-snug text-slate-500">
        Las sugerencias requieren confirmación del profesional. No reemplazan el criterio clínico.
      </p>

      {enabled ? (
        <Button type="button" variant="outline" size="sm" onClick={toggle} className="w-full">
          Abrir copiloto operativo
        </Button>
      ) : null}
    </aside>
  );
}

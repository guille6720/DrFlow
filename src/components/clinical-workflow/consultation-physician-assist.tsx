"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useDeferredPathologySearch } from "@/lib/hooks/use-deferred-pathology-search";
import { useFeatureFlag } from "@/components/plugins/clinic-plugins-provider";
import { InlinePhysicianAssist } from "@/components/clinical-workflow/inline-physician-assist";
import { resolveConsultationPathologyQuery } from "@/lib/utils/consultation-pathology-query";
import type { PhysicianAssistContext, PhysicianAssistItem } from "@/lib/utils/physician-assist-types";

type Props = {
  patientId: string;
  context: PhysicianAssistContext;
  evolutionText: string;
  onApplyToEvolution: (text: string) => void;
  pharmacologyHref?: string;
};

/** SOAP / consult workflow assist — differential, SOAP draft, interactions, discharge, certificate. */
export function ConsultationPhysicianAssist({
  patientId,
  context,
  evolutionText,
  onApplyToEvolution,
  pharmacologyHref,
}: Props) {
  const enabled = useFeatureFlag("consultation_assistant");
  const pathologyQuery = useMemo(
    () => resolveConsultationPathologyQuery(evolutionText),
    [evolutionText]
  );
  const { pathologies } = useDeferredPathologySearch({
    query: pathologyQuery,
    minLength: 3,
    debounceMs: 500,
  });

  const assistContext: PhysicianAssistContext = {
    ...context,
    evolutionText,
  };

  function handleApply(item: PhysicianAssistItem) {
    if (item.kind === "differential") {
      onApplyToEvolution(
        `${evolutionText.trim()}\n\n--- Diagnóstico diferencial (revisado) ---\n${item.body}`.trim()
      );
      return;
    }
    onApplyToEvolution(
      `${evolutionText.trim()}\n\n--- ${item.title} (revisado) ---\n${item.body}`.trim()
    );
  }

  if (!enabled) return null;

  const showCie10 = pathologies.length > 0 && pathologyQuery.length >= 3;

  return (
    <div className="space-y-2">
      <InlinePhysicianAssist
        context={assistContext}
        kinds={[
          "interaction_alert",
          "soap",
          "differential",
          "discharge_summary",
          "medical_certificate",
        ]}
        onApply={handleApply}
      />

      {showCie10 ? (
        <div className="rounded-lg border border-violet-100 bg-white px-3 py-2 text-sm text-slate-700">
          <p className="text-xs font-medium text-slate-500">CIE-10 sugerido (referencia)</p>
          <ul className="mt-1 space-y-0.5">
            {pathologies.slice(0, 3).map((p) => (
              <li key={p.id}>
                {p.name}{" "}
                <span className="font-mono text-xs text-teal-700">{p.cie10_code}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 text-xs">
        {pharmacologyHref ? (
          <Link href={pharmacologyHref} className="text-violet-700 hover:underline">
            Guía farmacológica →
          </Link>
        ) : null}
        <Link href={`/pacientes/${patientId}?tab=resumen`} className="text-violet-700 hover:underline">
          Ver resumen clínico →
        </Link>
      </div>
    </div>
  );
}

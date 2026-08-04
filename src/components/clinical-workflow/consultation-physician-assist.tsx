"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Mic } from "lucide-react";
import { useDeferredPathologySearch } from "@/lib/hooks/use-deferred-pathology-search";
import { useConsultationCie10Suggestions } from "@/lib/hooks/use-consultation-cie10-suggestions";
import { useFeatureFlag } from "@/components/plugins/clinic-plugins-provider";
import { InlinePhysicianAssist } from "@/components/clinical-workflow/inline-physician-assist";
import { ConsultationCie10Panel } from "@/components/clinical-workflow/consultation-cie10-panel";
import { resolveConsultationPathologyQuery } from "@/lib/utils/consultation-pathology-query";
import type { PhysicianAssistContext, PhysicianAssistItem } from "@/lib/utils/physician-assist-types";

type Props = {
  patientId: string;
  context: PhysicianAssistContext;
  evolutionText: string;
  onApplyToEvolution: (text: string) => void;
  pharmacologyHref?: string;
  /** Set when voice dictation appended text — prompts review of suggestions. */
  voiceDraftPending?: boolean;
};

const CONSULTATION_KINDS = [
  "interaction_alert",
  "evolution_draft",
  "soap",
  "physical_exam",
  "differential",
  "therapeutic_plan",
  "discharge_summary",
  "medical_certificate",
] as const;

/** SOAP / consult workflow — full documentation assist with CIE-10 (Phase B). */
export function ConsultationPhysicianAssist({
  patientId,
  context,
  evolutionText,
  onApplyToEvolution,
  pharmacologyHref,
  voiceDraftPending = false,
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

  const cie10Suggestions = useConsultationCie10Suggestions(assistContext);
  const showCie10 = cie10Suggestions.length > 0 || pathologies.length > 0;

  function handleApply(item: PhysicianAssistItem) {
    if (item.kind === "differential" || item.kind === "cie10_suggestion") {
      onApplyToEvolution(
        `${evolutionText.trim()}\n\n--- ${item.title} (revisado) ---\n${item.body}`.trim()
      );
      return;
    }
    onApplyToEvolution(
      `${evolutionText.trim()}\n\n--- ${item.title} (revisado) ---\n${item.body}`.trim()
    );
  }

  if (!enabled) return null;

  const hasEvolution = evolutionText.trim().length >= 8;

  return (
    <div className="space-y-2">
      {voiceDraftPending && hasEvolution ? (
        <p className="flex items-center gap-1.5 rounded-lg border border-teal-100 bg-teal-50/80 px-3 py-2 text-xs text-teal-800">
          <Mic className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Texto dictado — revisá las sugerencias antes de guardar.
        </p>
      ) : null}

      {hasEvolution ? (
        <InlinePhysicianAssist
          context={assistContext}
          kinds={[...CONSULTATION_KINDS]}
          onApply={handleApply}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-violet-200 bg-violet-50/40 px-3 py-2 text-xs text-violet-800">
          Escribí o dictá la evolución para generar SOAP, examen físico, diferencial y plan terapéutico.
        </p>
      )}

      {showCie10 && hasEvolution ? (
        <ConsultationCie10Panel ruleSuggestions={cie10Suggestions} pathologies={pathologies} />
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

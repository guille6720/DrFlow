"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, Sparkles } from "lucide-react";
import {
  buildLightweightPatientWarnings,
} from "@/lib/utils/clinical-assistant";
import { resolveConsultationPathologyQuery } from "@/lib/utils/consultation-pathology-query";
import { useDeferredPathologySearch } from "@/lib/hooks/use-deferred-pathology-search";
import { useFeatureFlag } from "@/components/plugins/clinic-plugins-provider";

type Props = {
  patientId: string;
  allergies?: string | null;
  regularMedication?: string | null;
  evolutionText: string;
  pharmacologyHref?: string;
};

export function ConsultationAssistantPanel({
  patientId,
  allergies,
  regularMedication,
  evolutionText,
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

  const warnings = useMemo(
    () =>
      buildLightweightPatientWarnings({
        allergies,
        regularMedication,
        evolutionText,
      }),
    [allergies, regularMedication, evolutionText]
  );

  const showCie10 = pathologies.length > 0 && pathologyQuery.length >= 3;

  if (!enabled) return null;
  if (warnings.length === 0 && !showCie10) return null;

  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-3 text-sm">
      <div className="mb-2 flex items-center gap-1.5 font-medium text-violet-900">
        <Sparkles className="h-4 w-4" />
        Asistente clínico
        <span className="text-xs font-normal text-violet-700">(sugerencias — no reemplaza criterio médico)</span>
      </div>

      {warnings.length > 0 ? (
        <ul className="mb-2 space-y-1">
          {warnings.map((w) => (
            <li key={w} className="flex items-start gap-1.5 text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      ) : null}

      {showCie10 ? (
        <div className="text-slate-700">
          <p className="text-xs font-medium text-slate-500">CIE-10 sugerido</p>
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

      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        {pharmacologyHref ? (
          <Link href={pharmacologyHref} className="text-violet-700 hover:underline">
            Guía farmacológica →
          </Link>
        ) : null}
        <Link href={`/pacientes/${patientId}?tab=ia`} className="text-violet-700 hover:underline">
          Asistente completo →
        </Link>
      </div>
    </div>
  );
}

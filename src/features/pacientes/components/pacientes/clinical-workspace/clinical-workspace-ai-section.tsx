"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { ClinicalSummaryPhysicianAssist } from "@/features/ia/components/clinical-workflow/clinical-summary-physician-assist";
import { usePatientClinicalAssistant } from "@/features/pacientes/hooks/use-patient-clinical-assistant";
import type { PatientChartViewProps } from "@/features/pacientes/components/pacientes/patient-chart-view-types";
import type { PatientEhrWorkspaceData } from "@/features/pacientes/server/load-patient-ehr-data";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

type Props = Pick<PatientChartViewProps, "chart" | "patient" | "patientId"> & {
  ehr: PatientEhrWorkspaceData;
  patientName: string;
  lastEvolution?: string | null;
  lastDiagnosis?: string | null;
};

/** AI clinical assistant — suggestions require physician confirmation. */
export function ClinicalWorkspaceAiSection({
  chart,
  patient,
  patientId,
  ehr,
  patientName,
  lastEvolution,
  lastDiagnosis,
}: Props) {
  const assistant = usePatientClinicalAssistant({ chart, patient, patientId, ehr, canIssue: false });

  return (
    <section aria-labelledby="cw-ai-title" className="drflow-clinical-workspace-section drflow-clinical-workspace-ai">
      <div className="drflow-clinical-workspace-section-head">
        <h3 id="cw-ai-title" className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-teal-400" aria-hidden />
          Asistente clínico
        </h3>
        <Link href={buildPatientWorkspaceUrl(patientId, { action: "copilot" })} className="drflow-patient-chart-link text-xs">
          Copilot →
        </Link>
      </div>

      <div className="space-y-3 text-sm">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase text-slate-500">Resumen</p>
          <ul className="space-y-0.5 text-slate-300">
            {assistant.summaryLines.slice(0, 5).map((line) => (
              <li key={line} className="text-xs">{line}</li>
            ))}
          </ul>
        </div>

        {chart.safetyWarnings.length > 0 ? (
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase text-amber-500">Interacciones / seguridad</p>
            <ul className="space-y-0.5">
              {chart.safetyWarnings.slice(0, 3).map((w) => (
                <li key={w} className="text-xs text-amber-200">{w}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {chart.reminders.length > 0 ? (
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase text-slate-500">Seguimientos pendientes</p>
            <ul className="space-y-0.5">
              {chart.reminders.slice(0, 4).map((r) => (
                <li key={r} className="text-xs text-slate-400">{r}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <ClinicalSummaryPhysicianAssist
        chart={chart}
        patientName={patientName}
        lastEvolution={lastEvolution}
        lastDiagnosis={lastDiagnosis}
      />

      <p className="mt-2 text-[10px] leading-snug text-slate-500">
        Las sugerencias requieren confirmación del profesional. No reemplazan el criterio clínico.
      </p>
    </section>
  );
}

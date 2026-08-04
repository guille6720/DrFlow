"use client";

import Link from "next/link";
import { CheckCircle2, Plus } from "lucide-react";
import type { PatientChartPayload } from "@/lib/utils/patient-chart-types";
import { buildPatientWorkspaceUrl } from "@/lib/utils/patient-workspace-actions";
import { patientWorkspacePath } from "@/lib/constants/patient-workspace-tabs";

type Props = {
  chart: PatientChartPayload;
  patientId: string;
  canEditClinical: boolean;
};

export function ClinicalWorkspaceProblemsSection({ chart, patientId, canEditClinical }: Props) {
  const active = chart.problems.filter((p) => p.status === "active");

  return (
    <section aria-labelledby="cw-problems-title" className="drflow-clinical-workspace-section">
      <div className="drflow-clinical-workspace-section-head">
        <h3 id="cw-problems-title">Problemas activos</h3>
        {canEditClinical ? (
          <Link
            href={buildPatientWorkspaceUrl(patientId, { tab: "soap", action: "nueva" })}
            className="drflow-patient-chart-link text-xs"
          >
            <Plus className="inline h-3 w-3" aria-hidden /> Agregar
          </Link>
        ) : null}
      </div>
      {active.length === 0 ? (
        <p className="drflow-patient-chart-muted text-sm">Sin problemas activos.</p>
      ) : (
        <ul className="drflow-clinical-workspace-compact-list">
          {active.slice(0, 6).map((p) => (
            <li key={p.id} className="drflow-clinical-workspace-problem-row">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.name}</p>
                <p className="text-[11px] text-slate-400">
                  {p.dateLabel} · {p.professionalName}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {p.recordId ? (
                  <Link href={`/historias/${p.recordId}`} className="drflow-patient-chart-link text-[11px]">
                    Abrir
                  </Link>
                ) : null}
                {canEditClinical && p.recordId ? (
                  <Link href={`/historias/${p.recordId}`} className="drflow-patient-chart-link text-[11px]">
                    Editar
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {chart.problems.length > 6 ? (
        <Link href={patientWorkspacePath(patientId, "problemas")} className="drflow-patient-chart-link mt-2 inline-block text-xs">
          Ver todos →
        </Link>
      ) : null}
    </section>
  );
}

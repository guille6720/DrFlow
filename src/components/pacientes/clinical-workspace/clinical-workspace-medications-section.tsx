"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { MedicationCard } from "@/lib/utils/patient-chart-types";
import type { PatientChartPayload } from "@/lib/utils/patient-chart-types";
import { detectMedicationFlags } from "@/lib/utils/clinical-workspace-alerts";
import { patientWorkspacePath } from "@/lib/constants/patient-workspace-tabs";

type Props = {
  chart: PatientChartPayload;
  patientId: string;
  filteredMeds: MedicationCard[];
};

export function ClinicalWorkspaceMedicationsSection({ chart, patientId, filteredMeds }: Props) {
  const flags = detectMedicationFlags(chart.medications);

  return (
    <section aria-labelledby="cw-meds-title" className="drflow-clinical-workspace-section">
      <div className="drflow-clinical-workspace-section-head">
        <h3 id="cw-meds-title">Medicación actual</h3>
        <Link href={patientWorkspacePath(patientId, "medicacion")} className="drflow-patient-chart-link text-xs">
          Ver módulo →
        </Link>
      </div>

      {flags.length > 0 ? (
        <ul className="mb-2 space-y-1">
          {flags.map((f) => (
            <li key={f} className="flex items-start gap-1.5 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {f}
            </li>
          ))}
        </ul>
      ) : null}

      {filteredMeds.length === 0 ? (
        <p className="drflow-patient-chart-muted text-sm">Sin medicación habitual registrada.</p>
      ) : (
        <ul className="drflow-clinical-workspace-compact-list">
          {filteredMeds.slice(0, 6).map((m) => (
            <li key={m.id} className="drflow-clinical-workspace-med-row">
              <div className="min-w-0">
                <p className="truncate font-medium">{m.name}</p>
                <p className="text-[11px] text-slate-400">
                  {m.dose} · {m.frequency} · Desde {m.sinceLabel}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

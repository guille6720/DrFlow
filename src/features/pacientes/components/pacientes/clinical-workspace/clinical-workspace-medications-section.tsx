import { AlertTriangle } from "lucide-react";
import Link from "next/link";

import { patientWorkspacePath } from "@/features/pacientes/constants/patient-workspace-tabs";
import { detectMedicationFlags } from "@/features/pacientes/utils/clinical-workspace-alerts";
import type { MedicationCard } from "@/features/pacientes/utils/patient-chart-model-types";
import type { PatientChartPayload } from "@/features/pacientes/utils/patient-chart-model-types";

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
                <p className="drflow-patient-chart-muted text-[11px]">
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

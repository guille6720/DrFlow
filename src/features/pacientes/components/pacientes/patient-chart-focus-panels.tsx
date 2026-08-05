import { Plus } from "lucide-react";
import Link from "next/link";

import { ChartSection } from "@/features/pacientes/components/pacientes/patient-chart-primitives";
import type {
  PatientChartPatient,
  PatientChartProfessional,
} from "@/features/pacientes/components/pacientes/patient-chart-view-types";
import type { PatientChartPayload } from "@/features/pacientes/utils/patient-chart-model-types";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

import { Card } from "@/components/ui/card";
import type { PrescriptionMedication } from "@/types/prescription";

export type PatientChartFocusBaseProps = {
  patient: PatientChartPatient;
  chart: PatientChartPayload;
  patientId: string;
  canEditClinical: boolean;
  canIssue: boolean;
  professionals: PatientChartProfessional[];
  lastMedications: PrescriptionMedication[] | null;
  regularMedication?: string | null;
};

export function PatientChartAllergiesPanel({ patient, chart, patientId, canEditClinical }: PatientChartFocusBaseProps) {
  return (
    <Card title="Alergias e intolerancias">
      <p className="drflow-patient-chart-allergy text-base">
        {chart.allergies.length > 0
          ? chart.allergies.join(" · ")
          : patient.allergies?.trim() || "Sin alergias registradas"}
      </p>
      {canEditClinical ? (
        <Link
          href={`/pacientes/${patientId}/editar#perfil-clinico`}
          className="drflow-patient-chart-link mt-4 inline-block text-sm"
        >
          Editar perfil clínico
        </Link>
      ) : null}
    </Card>
  );
}

export function PatientChartProblemsPanel({ chart, patientId, canEditClinical }: PatientChartFocusBaseProps) {
  return (
    <ChartSection
      title="Problemas activos"
      action={
        canEditClinical ? (
          <Link href={buildPatientWorkspaceUrl(patientId, { tab: "soap", action: "nueva" })} className="drflow-patient-chart-link text-sm">
            <Plus className="h-3.5 w-3.5" /> Agregar
          </Link>
        ) : null
      }
    >
      {chart.problems.length === 0 ? (
        <p className="drflow-patient-chart-muted text-sm">Sin problemas registrados.</p>
      ) : (
        <ul className="drflow-patient-chart-problems">
          {chart.problems.map((p) => (
            <li key={p.id}>
              <p className="font-medium">{p.name}</p>
              <p className="drflow-patient-chart-muted text-xs">
                {p.dateLabel} · {p.professionalName}
              </p>
              {p.recordId ? (
                <Link href={`/historias/${p.recordId}`} className="drflow-patient-chart-link text-xs">
                  Ver consulta
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </ChartSection>
  );
}

export {
  PatientChartDocumentsPanel,
  PatientChartMedicationPanel,
  PatientChartStudiesPanel,
  PatientChartVaccinesPanel,
  PatientChartVitalsPanel,
} from "@/features/pacientes/components/pacientes/patient-chart-detail-panels";

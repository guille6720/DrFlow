import { CheckCircle2, Plus, Search } from "lucide-react";
import Link from "next/link";

import { ChartSection } from "@/features/pacientes/components/pacientes/patient-chart-primitives";
import type {
  PatientChartPatient,
  PatientChartProfessional,
} from "@/features/pacientes/components/pacientes/patient-chart-view-types";
import { PatientChartLabsPanel, PatientChartVitalsGrid } from "@/features/pacientes/components/pacientes/patient-chart-vitals-grid";
import { RenewMedicationPanel } from "@/features/pacientes/components/pacientes/renew-medication-panel";
import type { PatientChartPayload } from "@/features/pacientes/utils/patient-chart-model-types";
import type { MedicationCard } from "@/features/pacientes/utils/patient-chart-model-types";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

import type { PrescriptionMedication } from "@/types/prescription";

type Props = {
  patient: PatientChartPatient;
  chart: PatientChartPayload;
  patientId: string;
  canEditClinical: boolean;
  canIssue: boolean;
  professionals: PatientChartProfessional[];
  lastMedications: PrescriptionMedication[] | null;
  regularMedication?: string | null;
  defaultProfessionalId?: string;
  medSearch: string;
  setMedSearch: (value: string) => void;
  filteredMeds: MedicationCard[];
};

export function PatientChartGridPrimary({
  patient,
  chart,
  patientId,
  canEditClinical,
  canIssue,
  professionals,
  lastMedications,
  regularMedication,
  defaultProfessionalId,
  medSearch,
  setMedSearch,
  filteredMeds,
}: Props) {
  return (
    <>
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
            {chart.problems.slice(0, 12).map((p) => (
              <li key={p.id}>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.name}</p>
                    <p className="drflow-patient-chart-muted text-xs">
                      {p.dateLabel} · {p.status === "active" ? "Activo" : "Resuelto"} ·{" "}
                      {p.professionalName}
                    </p>
                  </div>
                </div>
                {canEditClinical && p.recordId && (
                  <div className="mt-1 flex gap-2">
                    <Link href={`/historias/${p.recordId}`} className="drflow-patient-chart-link text-xs">
                      Editar
                    </Link>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </ChartSection>

      <ChartSection title="Medicación habitual">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 opacity-50" />
            <input
              type="search"
              placeholder="Buscar medicamento…"
              value={medSearch}
              onChange={(e) => setMedSearch(e.target.value)}
              className="drflow-patient-chart-input w-full pl-8"
            />
          </div>
          <Link href={`/pacientes/${patientId}/editar`} className="drflow-patient-chart-link text-xs">
            Editar habitual
          </Link>
        </div>
        {filteredMeds.length === 0 ? (
          <p className="drflow-patient-chart-muted text-sm">Sin medicación habitual.</p>
        ) : (
          <ul className="drflow-patient-chart-med-list">
            {filteredMeds.map((m) => (
              <li key={m.id} className="drflow-patient-chart-med-card">
                <p className="font-medium">{m.name}</p>
                <p className="text-xs">
                  {m.dose} · {m.frequency}
                </p>
                <p className="drflow-patient-chart-muted text-xs">
                  Desde {m.sinceLabel} · Últ. renovación {m.lastRenewalLabel}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {canIssue && professionals.length > 0 && (
                    <span className="drflow-patient-chart-muted text-xs">Usá «Renovar» abajo ↓</span>
                  )}
                  <Link href={`/pacientes/${patientId}/editar`} className="drflow-patient-chart-btn-outline">
                    Editar
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
        {canIssue && professionals.length > 0 && (
          <RenewMedicationPanel
            patientId={patientId}
            patient={patient}
            patientInsurance={patient.insurance_provider}
            regularMedication={regularMedication}
            lastMedications={lastMedications}
            professionals={professionals}
            defaultProfessionalId={defaultProfessionalId}
            canIssue={canIssue}
            compact
          />
        )}
      </ChartSection>

      <PatientChartVitalsGrid chart={chart} patientId={patientId} canEditClinical={canEditClinical} />
      <PatientChartLabsPanel chart={chart} patientId={patientId} />
    </>
  );
}

import Link from "next/link";
import { CheckCircle2, Plus, Search } from "lucide-react";
import { RenewMedicationPanel } from "@/components/pacientes/renew-medication-panel";
import { ChartSection, VitalsSparkline } from "@/components/pacientes/patient-chart-primitives";
import { patientClinicalHistoryPath } from "@/lib/utils/clinical-navigation";
import type {
  PatientChartPatient,
  PatientChartProfessional,
} from "@/components/pacientes/patient-chart-types";
import type { PatientChartPayload } from "@/lib/utils/patient-chart-types";
import type { MedicationCard } from "@/lib/utils/patient-chart-types";
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
            <Link href={`/historias/nueva?patient=${patientId}`} className="drflow-patient-chart-link text-sm">
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
            patientInsurance={patient.insurance_provider}
            regularMedication={regularMedication}
            lastMedications={lastMedications}
            professionals={professionals}
            canIssue={canIssue}
            compact
          />
        )}
      </ChartSection>

      <ChartSection
        title="Signos vitales"
        action={
          canEditClinical ? (
            <Link href={`/historias/nueva?patient=${patientId}`} className="drflow-patient-chart-link text-sm">
              Cargar nuevos signos
            </Link>
          ) : null
        }
      >
        <dl className="drflow-patient-chart-vitals-grid">
          <div>
            <dt>TA</dt>
            <dd>{chart.latestVitals.ta ?? "—"}</dd>
          </div>
          <div>
            <dt>FC</dt>
            <dd>{chart.latestVitals.fc ?? "—"}</dd>
          </div>
          <div>
            <dt>Peso</dt>
            <dd>{chart.latestVitals.weight ?? "—"}</dd>
          </div>
          <div>
            <dt>Talla</dt>
            <dd>{chart.latestVitals.height ?? "—"}</dd>
          </div>
          <div>
            <dt>IMC</dt>
            <dd>{chart.latestVitals.bmi ?? chart.indicators.bmi ?? "—"}</dd>
          </div>
          <div>
            <dt>Temp</dt>
            <dd>{chart.latestVitals.temp ?? "—"}</dd>
          </div>
          <div>
            <dt>Sat O₂</dt>
            <dd>{chart.latestVitals.spo2 ?? "—"}</dd>
          </div>
          <div>
            <dt>P. abdominal</dt>
            <dd>{chart.latestVitals.abdominal ?? "—"}</dd>
          </div>
        </dl>
        <VitalsSparkline vitals={chart.vitals} />
      </ChartSection>

      <ChartSection
        title="Últimos laboratorios"
        action={
          <Link href={`/pacientes/${patientId}/editar#perfil-clinico`} className="drflow-patient-chart-link text-sm">
            Cargar valores
          </Link>
        }
      >
        <ul className="drflow-patient-chart-labs">
          {chart.labPanel.map((lab) => (
            <li
              key={lab.name}
              className={
                lab.status === "empty"
                  ? "drflow-lab-empty"
                  : lab.status === "normal"
                    ? "drflow-lab-normal"
                    : lab.status === "high" || lab.status === "low"
                      ? `drflow-lab-${lab.status}`
                      : "drflow-lab-unknown"
              }
            >
              <span>{lab.name}</span>
              <strong>
                {lab.value}
                {lab.unit && lab.value !== "—" ? ` ${lab.unit}` : ""}
              </strong>
            </li>
          ))}
        </ul>
        <Link href={patientClinicalHistoryPath(patientId)} className="drflow-patient-chart-link mt-2 inline-block text-xs">
          Ver historial clínico completo
        </Link>
      </ChartSection>
    </>
  );
}

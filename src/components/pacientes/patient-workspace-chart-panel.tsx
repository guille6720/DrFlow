"use client";

import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ChartSection } from "@/components/pacientes/patient-chart-primitives";
import { RenewMedicationPanel } from "@/components/pacientes/renew-medication-panel";
import type {
  PatientChartPatient,
  PatientChartProfessional,
} from "@/components/pacientes/patient-chart-types";
import type { ClinicalDocumentItem } from "@/components/historias/clinical-documents-panel";
import type { PatientChartPayload } from "@/lib/utils/patient-chart-types";
import type { PrescriptionMedication } from "@/types/prescription";
import { usePatientChartMedicationFilter } from "@/lib/hooks/use-patient-chart";
import { Search } from "lucide-react";

export type PatientChartFocus =
  | "problemas"
  | "medicacion"
  | "alergias"
  | "vitales"
  | "estudios"
  | "archivos"
  | "vacunas";

type Props = {
  focus: PatientChartFocus;
  patient: PatientChartPatient;
  chart: PatientChartPayload;
  patientId: string;
  canEditClinical: boolean;
  canIssue: boolean;
  professionals: PatientChartProfessional[];
  lastMedications: PrescriptionMedication[] | null;
  regularMedication?: string | null;
  clinicalDocuments: ClinicalDocumentItem[];
};

export function PatientWorkspaceChartPanel({
  focus,
  patient,
  chart,
  patientId,
  canEditClinical,
  canIssue,
  professionals,
  lastMedications,
  regularMedication,
  clinicalDocuments,
}: Props) {
  const { medSearch, setMedSearch, filteredMeds } = usePatientChartMedicationFilter(chart);

  if (focus === "alergias") {
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

  if (focus === "problemas") {
    return (
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

  if (focus === "medicacion") {
    return (
      <Card title="Medicación habitual">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={medSearch}
              onChange={(e) => setMedSearch(e.target.value)}
              placeholder="Buscar medicamento…"
              className="drflow-patient-chart-input w-full pl-8"
            />
          </div>
          <Link href={`/pacientes/${patientId}/editar`} className="drflow-patient-chart-link text-xs">
            Editar ficha
          </Link>
        </div>
        {filteredMeds.length === 0 ? (
          <p className="drflow-patient-chart-muted text-sm">Sin medicación habitual.</p>
        ) : (
          <ul className="drflow-patient-chart-med-list">
            {filteredMeds.map((m) => (
              <li key={m.id} className="drflow-patient-chart-med-card">
                <p className="font-semibold">{m.name}</p>
                <p className="drflow-patient-chart-muted text-xs">
                  {m.dose} · {m.frequency}
                </p>
              </li>
            ))}
          </ul>
        )}
        {canIssue && lastMedications && lastMedications.length > 0 ? (
          <div className="mt-4">
            <RenewMedicationPanel
              patientId={patientId}
              lastMedications={lastMedications}
              professionals={professionals}
              regularMedication={regularMedication}
              patientInsurance={patient.insurance_provider}
              canIssue={canIssue}
              compact
            />
          </div>
        ) : null}
      </Card>
    );
  }

  if (focus === "vitales") {
    return (
      <ChartSection
        title="Signos vitales"
        action={
          canEditClinical ? (
            <Link href={`/historias/nueva?patient=${patientId}`} className="drflow-patient-chart-link text-sm">
              Registrar
            </Link>
          ) : null
        }
      >
        <dl className="drflow-patient-chart-vitals-grid">
          {chart.vitals.length === 0 ? (
            <p className="drflow-patient-chart-muted col-span-2 text-sm">Sin registros recientes.</p>
          ) : (
            chart.vitals.map((v) => (
              <div key={v.id}>
                <dt>{v.label}</dt>
                <dd>{v.raw}</dd>
              </div>
            ))
          )}
        </dl>
      </ChartSection>
    );
  }

  if (focus === "estudios") {
    return (
      <ChartSection title="Estudios" id="chart-estudios">
        {chart.studies.length === 0 ? (
          <p className="drflow-patient-chart-muted text-sm">Sin estudios PDF categorizados.</p>
        ) : (
          <ul className="drflow-patient-chart-studies">
            {chart.studies.map((s) => (
              <li key={s.id}>
                <span className="font-medium">{s.file_name}</span>
                <span className="drflow-patient-chart-muted ml-2 text-xs">{s.category ?? "General"}</span>
              </li>
            ))}
          </ul>
        )}
      </ChartSection>
    );
  }

  if (focus === "vacunas") {
    return (
      <ChartSection title="Vacunas">
        <ul className="drflow-patient-chart-vaccines">
          {(chart.vaccines ?? []).length === 0 ? (
            <li className="drflow-patient-chart-muted text-sm">Sin calendario registrado.</li>
          ) : (
            (chart.vaccines ?? []).map((v) => (
              <li key={v.name}>
                {v.name} — {v.status === "ok" ? "Al día" : v.status === "warn" ? "Revisar" : "Pendiente"}
                {v.year ? ` (${v.year})` : ""}
              </li>
            ))
          )}
        </ul>
      </ChartSection>
    );
  }

  if (focus === "archivos") {
    return (
      <div id="chart-documentos">
        <ChartSection title="Documentos clínicos">
          {clinicalDocuments.length === 0 ? (
            <p className="drflow-patient-chart-muted text-sm">Sin archivos adjuntos.</p>
          ) : (
            <ul className="drflow-patient-chart-studies">
              {clinicalDocuments.map((d) => (
                <li key={d.id}>
                  <span className="font-medium">{d.file_name}</span>
                  <span className="drflow-patient-chart-muted ml-2 text-xs">
                    {format(new Date(d.created_at), "d MMM yyyy", { locale: es })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ChartSection>
      </div>
    );
  }

  return null;
}

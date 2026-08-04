import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Search } from "lucide-react";
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
import { buildPatientWorkspaceUrl } from "@/lib/utils/patient-workspace-actions";

type BaseProps = {
  patient: PatientChartPatient;
  chart: PatientChartPayload;
  patientId: string;
  canEditClinical: boolean;
  canIssue: boolean;
  professionals: PatientChartProfessional[];
  lastMedications: PrescriptionMedication[] | null;
  regularMedication?: string | null;
};

export function PatientChartMedicationPanel({
  patientId,
  canIssue,
  professionals,
  lastMedications,
  regularMedication,
  patient,
  filteredMeds,
  medSearch,
  setMedSearch,
}: BaseProps & {
  filteredMeds: PatientChartPayload["medications"];
  medSearch: string;
  setMedSearch: (v: string) => void;
}) {
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

export function PatientChartVitalsPanel({ chart, patientId, canEditClinical }: BaseProps) {
  return (
    <ChartSection
      title="Signos vitales"
      action={
        canEditClinical ? (
          <Link href={buildPatientWorkspaceUrl(patientId, { tab: "soap", action: "nueva" })} className="drflow-patient-chart-link text-sm">
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

export function PatientChartStudiesPanel({ chart }: Pick<BaseProps, "chart">) {
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

export function PatientChartVaccinesPanel({ chart }: Pick<BaseProps, "chart">) {
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

export function PatientChartDocumentsPanel({ clinicalDocuments }: { clinicalDocuments: ClinicalDocumentItem[] }) {
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

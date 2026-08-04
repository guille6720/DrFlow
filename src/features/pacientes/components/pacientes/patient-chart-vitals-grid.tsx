import Link from "next/link";
import { ChartSection, VitalsSparkline } from "@/features/pacientes/components/pacientes/patient-chart-primitives";
import { patientClinicalHistoryPath } from "@/shared/utils/clinical-navigation";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";
import type { PatientChartPayload } from "@/features/pacientes/utils/patient-chart-model-types";

export function PatientChartVitalsGrid({
  chart,
  patientId,
  canEditClinical,
}: {
  chart: PatientChartPayload;
  patientId: string;
  canEditClinical: boolean;
}) {
  return (
    <ChartSection
      title="Signos vitales"
      action={
        canEditClinical ? (
          <Link href={buildPatientWorkspaceUrl(patientId, { tab: "soap", action: "nueva" })} className="drflow-patient-chart-link text-sm">
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
  );
}

export function PatientChartLabsPanel({
  chart,
  patientId,
}: {
  chart: PatientChartPayload;
  patientId: string;
}) {
  return (
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
  );
}

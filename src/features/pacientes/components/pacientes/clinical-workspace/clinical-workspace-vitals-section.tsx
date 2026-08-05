import Link from "next/link";

import { cn } from "@/shared/utils/cn";

import { VitalsSparkline } from "@/features/pacientes/components/pacientes/vitals-sparkline";
import type { PatientChartPayload } from "@/features/pacientes/utils/patient-chart-model-types";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

function isAbnormalVital(label: string, value: string | undefined): boolean {
  if (!value || value === "—") return false;
  if (label === "TA") {
    const match = value.match(/(\d+)\s*\/\s*(\d+)/);
    if (!match) return false;
    const sys = Number(match[1]);
    const dia = Number(match[2]);
    return sys >= 140 || sys < 90 || dia >= 90 || dia < 60;
  }
  if (label === "FC") {
    const n = parseInt(value, 10);
    return !Number.isNaN(n) && (n > 100 || n < 60);
  }
  if (label === "Temp") {
    const n = parseFloat(value.replace(",", "."));
    return !Number.isNaN(n) && (n >= 38 || n < 36);
  }
  if (label === "Sat O₂") {
    const n = parseInt(value, 10);
    return !Number.isNaN(n) && n < 94;
  }
  return false;
}

type VitalCell = { label: string; value: string | undefined };

export function ClinicalWorkspaceVitalsSection({
  chart,
  patientId,
  canEditClinical,
}: {
  chart: PatientChartPayload;
  patientId: string;
  canEditClinical: boolean;
}) {
  const cells: VitalCell[] = [
    { label: "TA", value: chart.latestVitals.ta },
    { label: "FC", value: chart.latestVitals.fc },
    { label: "FR", value: undefined },
    { label: "Temp", value: chart.latestVitals.temp },
    { label: "Peso", value: chart.latestVitals.weight },
    { label: "Talla", value: chart.latestVitals.height },
    { label: "IMC", value: chart.latestVitals.bmi ?? chart.indicators.bmi ?? undefined },
    { label: "Sat O₂", value: chart.latestVitals.spo2 },
    { label: "Dolor", value: undefined },
  ];

  const previous = chart.vitals[1];

  return (
    <section aria-labelledby="cw-vitals-title" className="drflow-clinical-workspace-section">
      <div className="drflow-clinical-workspace-section-head">
        <h3 id="cw-vitals-title">Signos vitales recientes</h3>
        {canEditClinical ? (
          <Link
            href={buildPatientWorkspaceUrl(patientId, { tab: "soap", action: "nueva" })}
            className="drflow-patient-chart-link text-xs"
          >
            Registrar
          </Link>
        ) : null}
      </div>
      <dl className="drflow-clinical-workspace-vitals-grid">
        {cells.map(({ label, value }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className={cn(isAbnormalVital(label, value) && "drflow-clinical-workspace-vital-abnormal")}>
              {value ?? "—"}
            </dd>
          </div>
        ))}
      </dl>
      {previous ? (
        <p className="mt-1 text-[11px] text-slate-500">
          Visita anterior: TA{" "}
          {previous.systolic && previous.diastolic ? `${previous.systolic}/${previous.diastolic}` : "—"} · FC{" "}
          {previous.heartRate ?? "—"}
        </p>
      ) : null}
      <VitalsSparkline vitals={chart.vitals} />
    </section>
  );
}

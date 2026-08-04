import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PamiPatientBanner } from "@/features/pacientes/components/pacientes/pami-patient-banner";
import { PatientIndicatorsCalculator } from "@/features/pacientes/components/pacientes/patient-indicators-calculator";
import { AlertBadge, IndicatorChip } from "@/features/pacientes/components/pacientes/patient-chart-primitives";
import type { PatientChartPatient } from "@/features/pacientes/components/pacientes/patient-chart-view-types";
import type { PatientChartPayload } from "@/features/pacientes/utils/patient-chart-model-types";

type Props = {
  patient: PatientChartPatient;
  chart: PatientChartPayload;
  patientId: string;
  canEditClinical: boolean;
};

function PersonalDataStrip({ patient }: { patient: PatientChartPatient }) {
  return (
    <details className="drflow-patient-chart-personal">
      <summary>Datos personales y contacto</summary>
      <dl className="drflow-patient-chart-dl-grid">
        <div>
          <dt>Teléfono</dt>
          <dd>{patient.phone ?? "—"}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{patient.email ?? "—"}</dd>
        </div>
        <div>
          <dt>Dirección</dt>
          <dd>{patient.address ?? "—"}</dd>
        </div>
        <div>
          <dt>Afiliado</dt>
          <dd>{patient.insurance_number ?? "—"}</dd>
        </div>
        <div>
          <dt>Emergencia</dt>
          <dd>
            {patient.emergency_contact_name ?? "—"}
            {patient.emergency_contact_phone ? ` (${patient.emergency_contact_phone})` : ""}
          </dd>
        </div>
      </dl>
    </details>
  );
}

export function PatientChartSummary({ patient, chart, patientId, canEditClinical }: Props) {
  return (
    <>
      <PamiPatientBanner patient={patient} />

      {chart.profileCompleteness.score < 100 && (
        <div className="drflow-patient-chart-profile-cta">
          <p>
            Perfil clínico al {chart.profileCompleteness.score}% — faltan:{" "}
            {chart.profileCompleteness.missing.join(", ")}
          </p>
          <Link
            href={`/pacientes/${patientId}/editar#perfil-clinico`}
            className="drflow-patient-chart-link text-sm"
          >
            Completar perfil
          </Link>
        </div>
      )}

      {(chart.reminders.length > 0 || chart.safetyWarnings.length > 0) && (
        <div className="drflow-patient-chart-reminders">
          {chart.reminders.map((r) => (
            <p key={r} className="drflow-patient-chart-reminder-item">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {r}
            </p>
          ))}
          {chart.safetyWarnings.map((w) => (
            <p key={w} className="drflow-patient-chart-safety">
              {w}
            </p>
          ))}
        </div>
      )}

      <section className="drflow-patient-chart-summary" aria-label="Resumen clínico">
        <div className="drflow-patient-chart-summary-main">
          <div>
            <p className="drflow-patient-chart-summary-age">{chart.ageLabel ?? "Edad —"}</p>
            <p className="drflow-patient-chart-summary-meta">
              {chart.sex} · {chart.insurance}
              {chart.bloodGroup !== "Sin registrar" ? ` · ${chart.bloodGroup}` : ""}
            </p>
          </div>
          <div className="drflow-patient-chart-summary-columns">
            <div>
              <p className="drflow-patient-chart-label">Problemas / crónicos</p>
              <ul>
                {(chart.activeProblemsText.length ? chart.activeProblemsText : chart.chronicConditions)
                  .slice(0, 6)
                  .map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                {!chart.activeProblemsText.length && !chart.chronicConditions.length && <li>—</li>}
              </ul>
            </div>
            <div>
              <p className="drflow-patient-chart-label">Alergias</p>
              <p className="drflow-patient-chart-allergy">
                {chart.allergies.length ? chart.allergies.join(", ") : "Sin registrar"}
              </p>
              <p className="drflow-patient-chart-label mt-2">Medicación crítica</p>
              <p>{chart.criticalMeds.length ? chart.criticalMeds.join(", ") : "—"}</p>
            </div>
            <div>
              <p className="drflow-patient-chart-label">Riesgos</p>
              <p>{chart.anticoagulated ? "Anticoagulado" : "No anticoagulado"}</p>
              <p>CV: {chart.cvRisk}</p>
              <p>{chart.smokingLabel}</p>
            </div>
            <div className="drflow-patient-chart-indicators">
              <p className="drflow-patient-chart-label">Indicadores</p>
              <div className="drflow-patient-chart-kpi-row">
                <IndicatorChip label="IMC" value={chart.indicators.bmi ?? "—"} />
                <IndicatorChip label="TFG" value={chart.indicators.tfg?.split(" ")[0] ?? "—"} />
                <IndicatorChip label="Riesgo CV" value={chart.cvRisk} />
                <IndicatorChip
                  label="Creatinina"
                  value={
                    chart.indicators.creatinine ? `${chart.indicators.creatinine} mg/dL` : "—"
                  }
                />
              </div>
              <PatientIndicatorsCalculator
                patientId={patientId}
                ageYears={chart.ageYears}
                extras={chart.extras}
                canEdit={canEditClinical}
              />
            </div>
          </div>
        </div>
        <PersonalDataStrip patient={patient} />
      </section>

      {chart.alerts.length > 0 && (
        <div className="drflow-patient-chart-alerts">
          {chart.alerts.map((a) => (
            <AlertBadge key={`${a.level}-${a.label}`} level={a.level} label={a.label} />
          ))}
        </div>
      )}
    </>
  );
}

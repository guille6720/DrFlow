"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileText,
  Pill,
  Plus,
  Search,
  Stethoscope,
  Syringe,
  Upload,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { PamiPatientBanner } from "@/components/pacientes/pami-patient-banner";
import { PatientAppShareControl } from "@/components/pacientes/patient-app-share-control";
import { RenewMedicationPanel } from "@/components/pacientes/renew-medication-panel";
import { PatientIndicatorsCalculator } from "@/components/pacientes/patient-indicators-calculator";
import { ClinicalDocumentsPanel } from "@/components/historias/clinical-documents-panel";
import type { ClinicalDocumentItem } from "@/components/historias/clinical-documents-panel";
import type { PatientChartPayload } from "@/lib/utils/patient-chart-types";
import type { PrescriptionMedication } from "@/types/prescription";
import type { DoctorShareInfo } from "@/lib/utils/doctor-share-info";
import { appointmentStatusBadge, Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type Professional = {
  id: string;
  display_name?: string | null;
  license_number?: string | null;
  profiles?: { full_name: string } | null;
};

type PatientRow = {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  insurance_provider: string | null;
  insurance_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  allergies: string | null;
  regular_medication: string | null;
};

export type AppointmentRow = {
  id: string;
  start_at: string;
  status: string;
  cancellation_reason?: string | null;
  cancelled_by_type?: string | null;
  professionals?: { profiles?: { full_name?: string } } | null;
};

function ChartSection({
  title,
  action,
  children,
  className = "",
  id,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`drflow-patient-chart-section ${className}`}>
      <header className="drflow-patient-chart-section-head">
        <h2>{title}</h2>
        {action}
      </header>
      <div className="drflow-patient-chart-section-body">{children}</div>
    </section>
  );
}

function AlertBadge({ level, label }: { level: "red" | "yellow" | "green"; label: string }) {
  return <span className={`drflow-chart-alert drflow-chart-alert-${level}`}>{label}</span>;
}

function VaccineIcon({ status }: { status: "ok" | "warn" | "missing" }) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-label="Al día" />;
  if (status === "warn") return <AlertTriangle className="h-4 w-4 text-amber-400" aria-label="Pendiente" />;
  return <span className="drflow-patient-chart-muted text-sm" aria-label="Sin dato">—</span>;
}

function IndicatorChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="drflow-patient-chart-kpi">
      <span className="drflow-patient-chart-kpi-label">{label}</span>
      <span className="drflow-patient-chart-kpi-value">{value}</span>
    </div>
  );
}

function VitalsSparkline({ vitals }: { vitals: PatientChartPayload["vitals"] }) {
  const points = useMemo(() => {
    const sorted = [...vitals].reverse().slice(-8);
    const weights = sorted.map((v) => v.weightKg).filter((w): w is number => w != null);
    if (weights.length < 2) {
      const sys = sorted.map((v) => v.systolic).filter((s): s is number => s != null);
      return { values: sys, label: "TA sistólica" };
    }
    return { values: weights, label: "Peso (kg)" };
  }, [vitals]);

  if (points.values.length < 2) {
    return <p className="drflow-patient-chart-muted text-xs">Agregá signos vitales para ver evolución.</p>;
  }

  const w = 200;
  const h = 48;
  const min = Math.min(...points.values);
  const max = Math.max(...points.values);
  const range = max - min || 1;
  const coords = points.values
    .map((v, i) => {
      const x = (i / (points.values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="mt-2">
      <p className="drflow-patient-chart-muted mb-1 text-xs">{points.label}</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-12 w-full max-w-[240px] text-teal-400" aria-hidden>
        <polyline fill="none" stroke="currentColor" strokeWidth="2" points={coords} />
      </svg>
    </div>
  );
}

export function PatientChartView({
  patient,
  chart,
  patientId,
  canEditClinical,
  canIssue,
  professionals,
  lastMedications,
  clinicalDocuments,
  appointments,
  portalSlug,
  doctorInfo,
  patientShare,
  arcoExport,
  regularMedication,
}: {
  patient: PatientRow;
  chart: PatientChartPayload;
  patientId: string;
  canEditClinical: boolean;
  canIssue: boolean;
  professionals: Professional[];
  lastMedications: PrescriptionMedication[] | null;
  clinicalDocuments: ClinicalDocumentItem[];
  appointments: AppointmentRow[];
  portalSlug: string | null;
  doctorInfo: DoctorShareInfo | null;
  patientShare: { sharedAt: string; sharedByName: string | null; channel: string } | null;
  arcoExport?: React.ReactNode;
  regularMedication?: string | null;
}) {
  const [medSearch, setMedSearch] = useState("");
  const filteredMeds = chart.medications.filter((m) =>
    medSearch.trim()
      ? m.name.toLowerCase().includes(medSearch.toLowerCase())
      : true
  );

  const personalStrip = (
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

  return (
    <div className="drflow-patient-chart">
      <div className="drflow-patient-chart-sticky-bar">
        <div className="drflow-patient-chart-sticky-inner">
          <Link href={`/historias/nueva?patient=${patientId}`}>
            <Button size="sm" type="button">
              <Stethoscope className="h-4 w-4" />
              Nueva consulta
            </Button>
          </Link>
          <Link href={`/historias/paciente/${patientId}`}>
            <Button size="sm" variant="outline" type="button">
              <ClipboardList className="h-4 w-4" />
              Historia clínica completa
            </Button>
          </Link>
          <Link href={`/recetas?patient=${patientId}`}>
            <Button size="sm" variant="outline" type="button">
              <Pill className="h-4 w-4" />
              Nueva receta
            </Button>
          </Link>
          <Link href={`/recetas?patient=${patientId}&tipo=orden`}>
            <Button size="sm" variant="outline" type="button">
              <ClipboardList className="h-4 w-4" />
              Nueva orden
            </Button>
          </Link>
          <Link href={`/historias/nueva?patient=${patientId}`}>
            <Button size="sm" variant="outline" type="button">
              <FileText className="h-4 w-4" />
              Nuevo certificado
            </Button>
          </Link>
          <a href="#chart-estudios">
            <Button size="sm" variant="outline" type="button">
              <Activity className="h-4 w-4" />
              Nuevo estudio
            </Button>
          </a>
          <a href="#chart-documentos">
            <Button size="sm" variant="outline" type="button">
              <Upload className="h-4 w-4" />
              Subir PDF
            </Button>
          </a>
          {arcoExport}
          <Link href={`/pacientes/${patientId}/editar`}>
            <Button size="sm" variant="outline" type="button">
              Editar ficha
            </Button>
          </Link>
        </div>
      </div>

      <PamiPatientBanner patient={patient} />

      {chart.profileCompleteness.score < 100 && (
        <div className="drflow-patient-chart-profile-cta">
          <p>
            Perfil clínico al {chart.profileCompleteness.score}% — faltan:{" "}
            {chart.profileCompleteness.missing.join(", ")}
          </p>
          <Link href={`/pacientes/${patientId}/editar#perfil-clinico`} className="drflow-patient-chart-link text-sm">
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
                {(chart.activeProblemsText.length ? chart.activeProblemsText : chart.chronicConditions).slice(0, 6).map((p) => (
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
                    chart.indicators.creatinine
                      ? `${chart.indicators.creatinine} mg/dL`
                      : "—"
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
        {personalStrip}
      </section>

      {chart.alerts.length > 0 && (
        <div className="drflow-patient-chart-alerts">
          {chart.alerts.map((a) => (
            <AlertBadge key={`${a.level}-${a.label}`} level={a.level} label={a.label} />
          ))}
        </div>
      )}

      <div className="drflow-patient-chart-grid">
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
                        {p.dateLabel} · {p.status === "active" ? "Activo" : "Resuelto"} · {p.professionalName}
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
              <Link
                href={`/historias/nueva?patient=${patientId}`}
                className="drflow-patient-chart-link text-sm"
              >
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
          <Link href={`/historias/paciente/${patientId}`} className="drflow-patient-chart-link mt-2 inline-block text-xs">
            Ver historial clínico completo
          </Link>
        </ChartSection>

        <ChartSection
          title="Últimas consultas"
          action={
            <Link href={`/historias/paciente/${patientId}`} className="drflow-patient-chart-link text-sm">
              Ver historia completa
            </Link>
          }
        >
          {chart.consultations.length === 0 ? (
            <p className="drflow-patient-chart-muted text-sm">Sin consultas.</p>
          ) : (
            <ol className="drflow-patient-chart-timeline">
              {chart.consultations.map((c) => (
                <li key={c.id}>
                  <Link href={`/historias/${c.id}`} className="drflow-patient-chart-link font-medium">
                    {c.dateLabel}
                  </Link>
                  <p className="text-sm">{c.motive}</p>
                  <p className="drflow-patient-chart-muted text-xs">{c.diagnosis}</p>
                  <p className="text-xs">{c.conduct}</p>
                </li>
              ))}
            </ol>
          )}
        </ChartSection>

        <ChartSection title="Antecedentes">
          <p className="drflow-patient-chart-label">Clínicos (ficha)</p>
          <p className="mb-3 whitespace-pre-wrap text-sm">
            {chart.chronicConditions.length
              ? chart.chronicConditions.join("\n")
              : "Sin antecedentes en ficha."}
          </p>
          <p className="drflow-patient-chart-label">Turnos recientes</p>
          {appointments.length === 0 ? (
            <p className="drflow-patient-chart-muted text-sm">Sin turnos.</p>
          ) : (
            <ul className="text-sm">
              {appointments.slice(0, 4).map((a) => {
                const statusInfo = appointmentStatusBadge[a.status as string];
                return (
                  <li key={a.id} className="border-b border-slate-600/30 py-1.5">
                    {format(new Date(a.start_at), "dd/MM/yyyy HH:mm", { locale: es })}
                    {statusInfo && (
                      <Badge variant={statusInfo.variant} className="ml-2">
                        {statusInfo.label}
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </ChartSection>

        <div className="drflow-patient-chart-triple">
        <ChartSection title="Vacunas" className="drflow-patient-chart-span-third">
          <ul className="drflow-patient-chart-vaccines">
            {(chart.vaccines ?? []).map((v) => (
              <li key={v.name}>
                <Syringe className="h-4 w-4 opacity-70" />
                {v.name}
                <VaccineIcon status={v.status} />
              </li>
            ))}
          </ul>
        </ChartSection>

        <ChartSection title="Hábitos" className="drflow-patient-chart-span-third">
          <dl className="drflow-patient-chart-habits">
            <div>
              <dt>Tabaco</dt>
              <dd>{chart.habits.smoker}</dd>
            </div>
            <div>
              <dt>Alcohol</dt>
              <dd>{chart.habits.alcohol}</dd>
            </div>
            <div>
              <dt>Actividad</dt>
              <dd>{chart.habits.activity}</dd>
            </div>
            <div>
              <dt>Alimentación</dt>
              <dd>{chart.habits.diet}</dd>
            </div>
            <div>
              <dt>Ocupación</dt>
              <dd>{chart.habits.occupation}</dd>
            </div>
            <div>
              <dt>Índice tabáquico</dt>
              <dd>{chart.habits.packYears}</dd>
            </div>
          </dl>
        </ChartSection>

        <ChartSection title="Familiares" className="drflow-patient-chart-span-third">
          {(chart.family ?? []).length === 0 ? (
            <p className="drflow-patient-chart-muted text-sm">
              Sin antecedentes familiares registrados.{" "}
              <Link href={`/pacientes/${patientId}/editar#perfil-clinico`} className="drflow-patient-chart-link">
                Completar perfil
              </Link>
            </p>
          ) : (
            <ul className="text-sm">
              {(chart.family ?? []).map((f) => (
                <li key={f.relation}>
                  <strong>{f.relation}:</strong> {f.conditions}
                </li>
              ))}
            </ul>
          )}
        </ChartSection>
        </div>

        <ChartSection title="Estudios" className="drflow-patient-chart-span-full" id="chart-estudios">
          {chart.studies.length === 0 ? (
            <p className="drflow-patient-chart-muted text-sm">Sin estudios PDF categorizados.</p>
          ) : (
            <ul className="drflow-patient-chart-studies">
              {chart.studies.map((s) => (
                <li key={s.id}>
                  <span>
                    {format(new Date(s.created_at), "dd/MM/yyyy", { locale: es })} · {s.file_name}
                  </span>
                  <a href="#chart-documentos" className="drflow-patient-chart-btn-outline">
                    Descargar
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="drflow-patient-chart-muted mt-2 text-xs">
            ECG, Rx, TAC, RMN, eco: adjuntá informes como PDF en Documentos (categoría Estudio).
          </p>
        </ChartSection>

        <div className="drflow-patient-chart-span-full" id="chart-documentos">
          {canEditClinical || clinicalDocuments.length > 0 ? (
            <ClinicalDocumentsPanel
              patientId={patientId}
              documents={clinicalDocuments}
              canEdit={canEditClinical}
              compact
            />
          ) : null}
        </div>

        {portalSlug && doctorInfo && (
          <div className="drflow-patient-chart-span-full">
            <Card title="App para el paciente">
              <PatientAppShareControl
                patientId={patientId}
                patientName={`${patient.first_name} ${patient.last_name}`}
                patientPhone={patient.phone}
                slug={portalSlug}
                doctor={doctorInfo}
                share={patientShare}
              />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

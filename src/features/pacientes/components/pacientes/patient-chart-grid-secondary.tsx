import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Syringe } from "lucide-react";
import { PatientAppShareControl } from "@/features/pacientes/components/pacientes/patient-app-share-control";
import { ClinicalDocumentsPanel } from "@/features/historias/components/historias/clinical-documents-panel";
import type { ClinicalDocumentItem } from "@/features/historias/components/historias/clinical-documents-panel";
import { ChartSection, VaccineIcon } from "@/features/pacientes/components/pacientes/patient-chart-primitives";
import type { PatientChartAppointment, PatientChartPatient } from "@/features/pacientes/components/pacientes/patient-chart-view-types";
import type { PatientChartPayload } from "@/features/pacientes/utils/patient-chart-model-types";
import type { DoctorShareInfo } from "@/lib/utils/doctor-share-info";
import { patientClinicalHistoryPath } from "@/shared/utils/clinical-navigation";
import { appointmentStatusBadge, Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type Props = {
  patient: PatientChartPatient;
  chart: PatientChartPayload;
  patientId: string;
  canEditClinical: boolean;
  appointments: PatientChartAppointment[];
  clinicalDocuments: ClinicalDocumentItem[];
  portalSlug: string | null;
  doctorInfo: DoctorShareInfo | null;
  patientShare: { sharedAt: string; sharedByName: string | null; channel: string } | null;
};

export function PatientChartGridSecondary({
  patient,
  chart,
  patientId,
  canEditClinical,
  appointments,
  clinicalDocuments,
  portalSlug,
  doctorInfo,
  patientShare,
}: Props) {
  return (
    <>
      <ChartSection
        title="Últimas consultas"
        action={
        <Link href={patientClinicalHistoryPath(patientId)} className="drflow-patient-chart-link text-sm">
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
    </>
  );
}

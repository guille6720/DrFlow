import {
  CalendarPlus,
  ClipboardList,
  FileText,
  Pill,
  Stethoscope,
  Upload,
} from "lucide-react";
import Link from "next/link";

import { PrintPageButton } from "@/core/components/ui/print-page-button";

import { patientInitials } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-shared";
import type { PatientChartPatient } from "@/features/pacientes/components/pacientes/patient-chart-view-types";
import type {
  PatientChartAppointment,
  PatientChartProfessional,
} from "@/features/pacientes/components/pacientes/patient-chart-view-types";
import type { PatientChartPayload } from "@/features/pacientes/utils/patient-chart-model-types";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

import { Button } from "@/components/ui/button";

type Props = {
  patient: PatientChartPatient;
  chart: PatientChartPayload;
  patientId: string;
  canEditClinical: boolean;
  canIssue: boolean;
  appointments: PatientChartAppointment[];
  professionals: PatientChartProfessional[];
};

function primaryPhysicianName(
  appointments: PatientChartAppointment[],
  professionals: PatientChartProfessional[]
): string {
  const upcoming = appointments.find((a) => a.professionals?.profiles?.full_name);
  if (upcoming?.professionals?.profiles?.full_name) {
    return upcoming.professionals.profiles.full_name;
  }
  const pro = professionals[0];
  return pro?.display_name ?? pro?.profiles?.full_name ?? "—";
}

export function ClinicalWorkspaceHeader({
  patient,
  chart,
  patientId,
  canEditClinical,
  canIssue,
  appointments,
  professionals,
}: Props) {
  return (
    <header
      className="drflow-clinical-workspace-header"
      aria-label="Encabezado del paciente"
    >
      <div className="drflow-clinical-workspace-header-main">
        <div className="drflow-clinical-workspace-avatar" aria-hidden>
          {patientInitials(patient.first_name, patient.last_name)}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="drflow-clinical-workspace-name">
            {patient.last_name}, {patient.first_name}
          </h2>
          <dl className="drflow-clinical-workspace-meta">
            <div>
              <dt>Edad</dt>
              <dd>{chart.ageLabel ?? "—"}</dd>
            </div>
            <div>
              <dt>Sexo</dt>
              <dd>{chart.sex}</dd>
            </div>
            <div>
              <dt>DNI</dt>
              <dd>{patient.document_number}</dd>
            </div>
            <div>
              <dt>Cobertura</dt>
              <dd>{chart.insurance}</dd>
            </div>
            <div>
              <dt>Médico tratante</dt>
              <dd>{primaryPhysicianName(appointments, professionals)}</dd>
            </div>
            <div>
              <dt>Grupo sanguíneo</dt>
              <dd>{chart.bloodGroup}</dd>
            </div>
            <div>
              <dt>Emergencia</dt>
              <dd>
                {patient.emergency_contact_name ?? "—"}
                {patient.emergency_contact_phone ? ` · ${patient.emergency_contact_phone}` : ""}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div
        className="drflow-clinical-workspace-header-actions"
        role="toolbar"
        aria-label="Acciones clínicas"
      >
        {canEditClinical ? (
          <Link href={buildPatientWorkspaceUrl(patientId, { tab: "soap", action: "nueva" })}>
            <Button size="sm" type="button">
              <Stethoscope className="h-4 w-4" aria-hidden />
              Iniciar consulta
            </Button>
          </Link>
        ) : null}
        {canEditClinical ? (
          <Link href={buildPatientWorkspaceUrl(patientId, { tab: "soap", action: "nueva" })}>
            <Button size="sm" variant="outline" type="button">
              Nueva SOAP
            </Button>
          </Link>
        ) : null}
        {canIssue ? (
          <Link href={buildPatientWorkspaceUrl(patientId, { tab: "recetas", action: "nueva" })}>
            <Button size="sm" variant="outline" type="button">
              <Pill className="h-4 w-4" aria-hidden />
              Receta
            </Button>
          </Link>
        ) : null}
        {canIssue ? (
          <Link href={buildPatientWorkspaceUrl(patientId, { tab: "ordenes", action: "nueva" })}>
            <Button size="sm" variant="outline" type="button">
              <ClipboardList className="h-4 w-4" aria-hidden />
              Orden
            </Button>
          </Link>
        ) : null}
        {canEditClinical ? (
          <Link href={buildPatientWorkspaceUrl(patientId, { tab: "estudios", action: "estudio" })}>
            <Button size="sm" variant="outline" type="button">
              <Upload className="h-4 w-4" aria-hidden />
              Subir estudio
            </Button>
          </Link>
        ) : null}
        <PrintPageButton />
        {canIssue ? (
          <Link href={buildPatientWorkspaceUrl(patientId, { action: "certificado" })}>
            <Button size="sm" variant="ghost" type="button">
              <FileText className="h-4 w-4" aria-hidden />
              Certificado
            </Button>
          </Link>
        ) : null}
        <Link href={`/turnos/nuevo?patient=${patientId}`}>
          <Button size="sm" variant="ghost" type="button">
            <CalendarPlus className="h-4 w-4" aria-hidden />
            Seguimiento
          </Button>
        </Link>
      </div>
    </header>
  );
}

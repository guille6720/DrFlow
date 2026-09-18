"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { DrappConsultaWorkspace } from "@/features/historias/components/consultas/drapp-consulta-workspace";
import type { PatientEhrViewProps } from "@/features/historias/components/historias/patient-ehr-types";
import type { PatientChartProfessional } from "@/features/pacientes/components/pacientes/patient-chart-view-types";
import type { PatientEhrClinicalRecordsPagination } from "@/features/pacientes/server/load-patient-ehr-data";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

import type { Patient } from "@/types/database";

type Template = {
  id: string;
  name: string;
  chief_complaint_template: string | null;
  diagnosis_template: string | null;
  evolution_template: string | null;
  indications_template: string | null;
};

type Props = PatientEhrViewProps & {
  patientRecord: Patient;
  professionals: PatientChartProfessional[];
  templates: Template[];
  defaultProfessionalId?: string | null;
  clinicalRecordsPagination?: PatientEhrClinicalRecordsPagination;
  canIssue?: boolean;
  /** @deprecated Kept for call-site compat; HC uses the same Drapp workspace as Consultas. */
  consultasSession?: {
    appointmentId: string;
    professionalId?: string | null;
  } | null;
};

/**
 * Historia clínica del paciente (tab HC / soap).
 * Misma UI que Médicos → Consultas (`DrappConsultaWorkspace`), independiente del rol.
 */
export function PatientSoapWorkspace({
  patient,
  consultations,
  diagnosisRows,
  treatmentRows,
  attachments,
  prescriptions,
  totalConsultations,
  usesHceExport = false,
  patientRecord,
  professionals,
  templates,
  defaultProfessionalId,
  clinicalRecordsPagination,
  canIssue = false,
}: Props) {
  const router = useRouter();

  const onOpenSheet = useCallback(
    (sheet: "receta" | "orden" | "archivo") => {
      router.push(
        buildPatientWorkspaceUrl(patient.id, {
          tab: "soap",
          sheet,
          focus: sheet === "archivo" ? "evolucion" : undefined,
        }),
        { scroll: false }
      );
    },
    [patient.id, router]
  );

  return (
    <DrappConsultaWorkspace
      patient={patient}
      consultations={consultations}
      diagnosisRows={diagnosisRows}
      treatmentRows={treatmentRows}
      attachments={attachments}
      prescriptions={prescriptions}
      totalConsultations={totalConsultations}
      usesHceExport={usesHceExport}
      patientRecord={patientRecord}
      professionals={professionals}
      templates={templates}
      defaultProfessionalId={defaultProfessionalId}
      clinicalRecordsPagination={clinicalRecordsPagination}
      canIssue={canIssue}
      onOpenSheet={onOpenSheet}
    />
  );
}

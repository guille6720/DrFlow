"use client";

import { ConsultationFlowBar } from "@/components/historias/consultation-flow-bar";
import { NuevaConsultaFormBody } from "@/components/historias/nueva-consulta-form-body";
import { PamiPatientBanner } from "@/components/pacientes/pami-patient-banner";
import { PatientWorkspaceOverlay } from "@/components/pacientes/workspace/patient-workspace-overlay";
import { useNuevaConsultaForm } from "@/lib/hooks/use-nueva-consulta-form";
import type { PatientChartProfessional } from "@/components/pacientes/patient-chart-types";
import type { Patient } from "@/types/database";

type Template = {
  id: string;
  name: string;
  chief_complaint_template: string | null;
  diagnosis_template: string | null;
  evolution_template: string | null;
  indications_template: string | null;
};

type Props = {
  open: boolean;
  patient: Patient;
  patients: Patient[];
  professionals: PatientChartProfessional[];
  templates: Template[];
  canIssuePrescriptions: boolean;
  appointmentId?: string | null;
  professionalId?: string | null;
  onClose: () => void;
  onSaved: (recordId: string) => void;
};

export function PatientConsultSheet({
  open,
  patient,
  patients,
  professionals,
  templates,
  canIssuePrescriptions,
  appointmentId,
  professionalId,
  onClose,
  onSaved,
}: Props) {
  const form = useNuevaConsultaForm({
    patients,
    professionals,
    templates,
    workspace: {
      patientId: patient.id,
      appointmentId: appointmentId ?? undefined,
      professionalId: professionalId ?? undefined,
      onSaved,
      onClose,
    },
  });

  return (
    <PatientWorkspaceOverlay
      open={open}
      title={form.fromAppointment ? "Consulta en curso" : "Nueva consulta"}
      subtitle={
        form.fromAppointment ? "Flujo: agenda → consulta → receta" : `${patient.last_name}, ${patient.first_name}`
      }
      onClose={onClose}
      wide
      closeDisabled={form.loading}
    >
      <div className="space-y-4">
        {form.fromAppointment ? (
          <ConsultationFlowBar
            appointmentId={form.appointmentId}
            patient={form.selectedPatient}
            showSteps={false}
            recetaHref={
              canIssuePrescriptions && form.consultationContext ? form.recetaHref() : undefined
            }
            onRecetaClick={form.flushEvolutionDraft}
          />
        ) : null}

        <PamiPatientBanner patient={patient} />

        <NuevaConsultaFormBody
          form={form}
          patients={patients}
          professionals={professionals}
          templates={templates}
          canIssuePrescriptions={canIssuePrescriptions}
        />
      </div>
    </PatientWorkspaceOverlay>
  );
}

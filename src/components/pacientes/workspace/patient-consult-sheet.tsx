"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { ConsultationFlowBar } from "@/components/historias/consultation-flow-bar";
import { clearConsultationTimer } from "@/components/historias/consultation-timer";
import { NuevaConsultaFormBody } from "@/components/historias/nueva-consulta-form-body";
import { PamiPatientBanner } from "@/components/pacientes/pami-patient-banner";
import { PatientWorkspaceOverlay } from "@/components/pacientes/workspace/patient-workspace-overlay";
import { Button } from "@/components/ui/button";
import { finalizeConsultation } from "@/lib/actions/appointments";
import { useNuevaConsultaForm } from "@/lib/hooks/use-nueva-consulta-form";
import { buildPatientWorkspaceUrl } from "@/lib/utils/patient-workspace-actions";
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
  const router = useRouter();
  const [finalizing, setFinalizing] = useState(false);

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

  const onFinalizeConsult = useCallback(async () => {
    const id = appointmentId ?? form.appointmentId;
    if (!id) return;
    setFinalizing(true);
    const result = await finalizeConsultation(id, "presencial");
    setFinalizing(false);
    if (!result.error) {
      clearConsultationTimer(id);
      router.push(buildPatientWorkspaceUrl(patient.id, { tab: "soap" }));
      router.refresh();
    }
  }, [appointmentId, form.appointmentId, patient.id, router]);

  const showFinalize = Boolean(appointmentId ?? form.fromAppointment);

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
      headerActions={
        showFinalize ? (
          <Button
            size="sm"
            type="button"
            loading={finalizing}
            onClick={() => void onFinalizeConsult()}
            title="Cerrar consulta (Ctrl+Shift+Enter)"
            className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
          >
            <CheckCircle2 className="h-4 w-4" />
            Cerrar consulta
          </Button>
        ) : null
      }
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

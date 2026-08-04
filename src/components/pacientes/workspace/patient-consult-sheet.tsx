"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SkipForward } from "lucide-react";
import { ConsultationFlowBar } from "@/components/historias/consultation-flow-bar";
import { clearConsultationTimer } from "@/components/historias/consultation-timer";
import { NuevaConsultaFormBody } from "@/components/historias/nueva-consulta-form-body";
import { ConsultationJourneyFinishStep } from "@/components/clinical-workflow/consultation-journey-finish-step";
import { ConsultationJourneyFollowUpStep } from "@/components/clinical-workflow/consultation-journey-follow-up-step";
import { ConsultationJourneyStepper } from "@/components/clinical-workflow/consultation-journey-stepper";
import { PamiPatientBanner } from "@/components/pacientes/pami-patient-banner";
import { PatientWorkspaceOverlay } from "@/components/pacientes/workspace/patient-workspace-overlay";
import { PrescriptionForm } from "@/components/recetas/prescription-form";
import { MedicalOrderForm } from "@/components/recetas/medical-order-form";
import { Button } from "@/components/ui/button";
import { finalizeConsultation } from "@/lib/actions/appointments";
import { useConsultationJourney } from "@/lib/hooks/use-consultation-journey";
import { useNuevaConsultaForm } from "@/lib/hooks/use-nueva-consulta-form";
import { journeyStepSubtitle } from "@/lib/utils/consultation-journey";
import { buildPatientWorkspaceUrl } from "@/lib/utils/patient-workspace-actions";
import type { PatientChartProfessional } from "@/components/pacientes/patient-chart-types";
import type { PrescriptionMedication } from "@/types/prescription";
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
  lastMedications?: PrescriptionMedication[] | null;
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
  lastMedications,
  onClose,
  onSaved,
}: Props) {
  const router = useRouter();
  const [finalizing, setFinalizing] = useState(false);
  const journeyEnabled = Boolean(appointmentId);

  const journey = useConsultationJourney({
    enabled: journeyEnabled,
    canIssue: canIssuePrescriptions,
  });
  const resetJourney = journey.reset;

  const handleEvolutionSaved = useCallback(
    (recordId: string) => {
      if (journey.enabled) {
        journey.onEvolutionSaved(recordId);
        router.refresh();
        return;
      }
      onSaved(recordId);
    },
    [journey, onSaved, router]
  );

  const workspaceConfig = useMemo(
    () => ({
      patientId: patient.id,
      appointmentId: appointmentId ?? undefined,
      professionalId: professionalId ?? undefined,
      onSaved: handleEvolutionSaved,
      onClose,
    }),
    [appointmentId, handleEvolutionSaved, onClose, patient.id, professionalId]
  );

  const form = useNuevaConsultaForm({
    patients,
    professionals,
    templates,
    workspace: workspaceConfig,
  });

  const activeProfessionalId = professionalId ?? form.defaultProfessional;
  const patientName = `${patient.last_name}, ${patient.first_name}`;
  const assistBase = {
    patientName,
    allergies: patient.allergies,
    regularMedication: patient.regular_medication,
    diagnosis: form.evolution ? form.evolution.slice(0, 200) : null,
    insurance: patient.insurance_provider ?? undefined,
    insurancePlan: patient.insurance_plan,
  };

  useEffect(() => {
    if (!open) resetJourney();
  }, [open, resetJourney]);

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
      onClose();
    }
  }, [appointmentId, form.appointmentId, onClose, patient.id, router]);

  const overlayTitle = journey.enabled
    ? `Consulta — ${journey.steps.find((s) => s.id === journey.currentStep)?.label ?? "En curso"}`
    : form.fromAppointment
      ? "Consulta en curso"
      : "Nueva consulta";

  const overlaySubtitle = journey.enabled
    ? journeyStepSubtitle(journey.currentStep)
    : form.fromAppointment
      ? `${patientName}`
      : patientName;

  return (
    <PatientWorkspaceOverlay
      open={open}
      title={overlayTitle}
      subtitle={overlaySubtitle}
      onClose={onClose}
      wide
      closeDisabled={form.loading || finalizing}
    >
      <div className="space-y-4">
        {journey.enabled ? (
          <ConsultationJourneyStepper
            steps={journey.steps}
            currentStep={journey.currentStep}
            stepStatus={journey.stepStatus}
            onStepClick={journey.goToStep}
          />
        ) : null}

        {form.fromAppointment && journey.currentStep === "evolution" ? (
          <ConsultationFlowBar
            appointmentId={form.appointmentId}
            patient={form.selectedPatient}
            showSteps={false}
            hideRecetaLink={journey.enabled}
            hideFinalize={journey.enabled}
          />
        ) : null}

        {journey.currentStep === "evolution" ? (
          <>
            <PamiPatientBanner patient={patient} />
            <NuevaConsultaFormBody
              form={form}
              patients={patients}
              professionals={professionals}
              templates={templates}
              canIssuePrescriptions={canIssuePrescriptions}
              journeyMode={journey.enabled}
            />
          </>
        ) : null}

        {journey.enabled && journey.currentStep === "prescription" ? (
          <div className="space-y-3">
            <PrescriptionForm
              patientId={patient.id}
              patientInsurance={patient.insurance_provider}
              clinicalRecordId={journey.clinicalRecordId ?? undefined}
              professionals={professionals}
              defaultProfessionalId={activeProfessionalId ?? undefined}
              initialMedications={lastMedications ?? undefined}
              onSuccess={() => {
                journey.completeStep("prescription");
                router.refresh();
              }}
              assistContext={assistBase}
            />
            <div className="flex justify-start">
              <Button type="button" variant="outline" onClick={() => journey.skipStep("prescription")}>
                <SkipForward className="h-4 w-4" />
                Omitir receta
              </Button>
            </div>
          </div>
        ) : null}

        {journey.enabled && journey.currentStep === "order" ? (
          <div className="space-y-3">
            <MedicalOrderForm
              patientId={patient.id}
              clinicalRecordId={journey.clinicalRecordId ?? undefined}
              professionals={professionals}
              defaultProfessionalId={activeProfessionalId ?? undefined}
              onSuccess={() => {
                journey.completeStep("order");
                router.refresh();
              }}
              assistContext={{
                ...assistBase,
                lastEvolution: form.evolution || null,
              }}
            />
            <div className="flex justify-start">
              <Button type="button" variant="outline" onClick={() => journey.skipStep("order")}>
                <SkipForward className="h-4 w-4" />
                Omitir orden
              </Button>
            </div>
          </div>
        ) : null}

        {journey.enabled && journey.currentStep === "follow_up" ? (
          <ConsultationJourneyFollowUpStep
            patientId={patient.id}
            professionalId={activeProfessionalId ?? undefined}
            onScheduled={() => {
              journey.completeStep("follow_up");
              router.refresh();
            }}
            onSkip={() => journey.skipStep("follow_up")}
          />
        ) : null}

        {journey.enabled && journey.currentStep === "finish" ? (
          <ConsultationJourneyFinishStep
            steps={journey.steps}
            stepStatus={journey.stepStatus}
            patientName={patientName}
            finalizing={finalizing}
            onFinalize={() => void onFinalizeConsult()}
            onBack={() => journey.goToStep("follow_up")}
          />
        ) : null}
      </div>
    </PatientWorkspaceOverlay>
  );
}

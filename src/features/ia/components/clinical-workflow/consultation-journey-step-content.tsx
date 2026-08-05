"use client";

import { SkipForward } from "lucide-react";

import { cn } from "@/shared/utils/cn";

import { ConsultationFlowBar } from "@/features/historias/components/historias/consultation-flow-bar";
import { NuevaConsultaFormBody } from "@/features/historias/components/historias/nueva-consulta-form-body";
import { ConsultationJourneyFinishStep } from "@/features/ia/components/clinical-workflow/consultation-journey-finish-step";
import { ConsultationJourneyFollowUpStep } from "@/features/ia/components/clinical-workflow/consultation-journey-follow-up-step";
import { ConsultationJourneyStepper } from "@/features/ia/components/clinical-workflow/consultation-journey-stepper";
import { PamiPatientBanner } from "@/features/pacientes/components/pacientes/pami-patient-banner";
import type { PatientConsultSheetInput, PatientConsultSheetState } from "@/features/pacientes/hooks/use-patient-consult-sheet";
import { MedicalOrderForm } from "@/features/recetas/components/recetas/medical-order-form";
import { PrescriptionForm } from "@/features/recetas/components/recetas/prescription-form";

import { Button } from "@/components/ui/button";
import type { PrescriptionMedication } from "@/types/prescription";

type Props = PatientConsultSheetInput &
  PatientConsultSheetState & {
    lastMedications?: PrescriptionMedication[] | null;
    /** Expande el paso de evolución para usar el alto del overlay fullscreen. */
    fillViewport?: boolean;
  };

/** Presentation-only: renders the active consultation / journey step. */
export function ConsultationJourneyStepContent({
  patient,
  patients,
  professionals,
  templates,
  canIssuePrescriptions,
  lastMedications,
  journey,
  form,
  assistBase,
  activeProfessionalId,
  patientName,
  finalizing,
  onFinalizeConsult,
  onStepCompleted,
  fillViewport = false,
}: Props) {
  return (
    <div className={cn("space-y-4", fillViewport && "flex min-h-0 flex-1 flex-col gap-4 overflow-hidden")}>
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
        <div
          className={cn(
            "space-y-4",
            fillViewport && "flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
          )}
        >
          <PamiPatientBanner patient={patient} />
          <NuevaConsultaFormBody
            form={form}
            patients={patients}
            professionals={professionals}
            templates={templates}
            canIssuePrescriptions={canIssuePrescriptions}
            journeyMode={journey.enabled}
            fillViewport={fillViewport}
          />
        </div>
      ) : null}

      {journey.enabled && journey.currentStep === "prescription" ? (
        <JourneySkipWrapper onSkip={() => journey.skipStep("prescription")} skipLabel="Omitir receta">
          <PrescriptionForm
            patientId={patient.id}
            patientInsurance={patient.insurance_provider}
            clinicalRecordId={journey.clinicalRecordId ?? undefined}
            professionals={professionals}
            defaultProfessionalId={activeProfessionalId ?? undefined}
            initialMedications={lastMedications ?? undefined}
            onSuccess={() => onStepCompleted("prescription")}
            assistContext={assistBase}
          />
        </JourneySkipWrapper>
      ) : null}

      {journey.enabled && journey.currentStep === "order" ? (
        <JourneySkipWrapper onSkip={() => journey.skipStep("order")} skipLabel="Omitir orden">
          <MedicalOrderForm
            patientId={patient.id}
            clinicalRecordId={journey.clinicalRecordId ?? undefined}
            professionals={professionals}
            defaultProfessionalId={activeProfessionalId ?? undefined}
            onSuccess={() => onStepCompleted("order")}
            assistContext={{
              ...assistBase,
              lastEvolution: form.evolution || null,
            }}
          />
        </JourneySkipWrapper>
      ) : null}

      {journey.enabled && journey.currentStep === "follow_up" ? (
        <ConsultationJourneyFollowUpStep
          patientId={patient.id}
          professionalId={activeProfessionalId ?? undefined}
          assistContext={{
            ...assistBase,
            evolutionText: form.evolution || assistBase.evolutionText,
            lastEvolution: form.evolution || assistBase.lastEvolution,
          }}
          onScheduled={() => onStepCompleted("follow_up")}
          onSkip={() => journey.skipStep("follow_up")}
        />
      ) : null}

      {journey.enabled && journey.currentStep === "finish" ? (
        <ConsultationJourneyFinishStep
          steps={journey.steps}
          stepStatus={journey.stepStatus}
          patientName={patientName}
          assistContext={{
            ...assistBase,
            evolutionText: form.evolution || assistBase.evolutionText,
            lastEvolution: form.evolution || assistBase.lastEvolution,
          }}
          finalizing={finalizing}
          onFinalize={() => void onFinalizeConsult()}
          onBack={() => journey.goToStep("follow_up")}
        />
      ) : null}
    </div>
  );
}

function JourneySkipWrapper({
  children,
  onSkip,
  skipLabel,
}: {
  children: React.ReactNode;
  onSkip: () => void;
  skipLabel: string;
}) {
  return (
    <div className="space-y-3">
      {children}
      <div className="flex justify-start">
        <Button type="button" variant="outline" onClick={onSkip}>
          <SkipForward className="h-4 w-4" />
          {skipLabel}
        </Button>
      </div>
    </div>
  );
}

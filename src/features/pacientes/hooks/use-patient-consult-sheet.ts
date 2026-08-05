"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { clearConsultationTimer } from "@/features/historias/components/historias/consultation-timer";
import { useConsultationJourney } from "@/features/historias/hooks/use-consultation-journey";
import { useNuevaConsultaForm } from "@/features/historias/hooks/use-nueva-consulta-form";
import type { PhysicianAssistContext } from "@/features/ia/types/physician-assist-types";
import type { PatientChartProfessional } from "@/features/pacientes/components/pacientes/patient-chart-view-types";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

import { finalizeConsultation } from "@/lib/actions/appointments";
import { journeyStepSubtitle } from "@/lib/utils/consultation-journey";
import type { Patient } from "@/types/database";
import type { PrescriptionMedication } from "@/types/prescription";

type Template = {
  id: string;
  name: string;
  chief_complaint_template: string | null;
  diagnosis_template: string | null;
  evolution_template: string | null;
  indications_template: string | null;
};

export type PatientConsultSheetInput = {
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

/** Orchestration hook: journey state, consult form, finalize, navigation. */
export function usePatientConsultSheet({
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
}: PatientConsultSheetInput) {
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

  const assistBase: PhysicianAssistContext = useMemo(
    () => ({
      patientName,
      allergies: patient.allergies,
      regularMedication: patient.regular_medication,
      diagnosis: form.evolution ? form.evolution.slice(0, 200) : null,
      insurance: patient.insurance_provider ?? undefined,
      insurancePlan: patient.insurance_plan,
    }),
    [
      form.evolution,
      patient.allergies,
      patient.insurance_plan,
      patient.insurance_provider,
      patient.regular_medication,
      patientName,
    ]
  );

  useEffect(() => {
    if (!open) resetJourney();
  }, [open, resetJourney]);

  const refreshAfterStep = useCallback(() => {
    router.refresh();
  }, [router]);

  const onStepCompleted = useCallback(
    (step: "prescription" | "order" | "follow_up") => {
      journey.completeStep(step);
      refreshAfterStep();
    },
    [journey, refreshAfterStep]
  );

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
    : patientName;

  return {
    journey,
    form,
    assistBase,
    activeProfessionalId,
    patientName,
    finalizing,
    overlayTitle,
    overlaySubtitle,
    onFinalizeConsult,
    onStepCompleted,
    refreshAfterStep,
  };
}

export type PatientConsultSheetState = ReturnType<typeof usePatientConsultSheet>;

"use client";

import { PatientWorkspaceOverlay } from "@/components/pacientes/workspace/patient-workspace-overlay";
import { ConsultationJourneyStepContent } from "@/components/clinical-workflow/consultation-journey-step-content";
import {
  usePatientConsultSheet,
  type PatientConsultSheetInput,
} from "@/lib/hooks/use-patient-consult-sheet";

export type PatientConsultSheetProps = PatientConsultSheetInput;

/** Thin shell: overlay chrome + presentation delegated to step content. */
export function PatientConsultSheet(props: PatientConsultSheetProps) {
  const { open, onClose, lastMedications, ...rest } = props;
  const state = usePatientConsultSheet(props);

  return (
    <PatientWorkspaceOverlay
      open={open}
      title={state.overlayTitle}
      subtitle={state.overlaySubtitle}
      onClose={onClose}
      wide
      closeDisabled={state.form.loading || state.finalizing}
    >
      <ConsultationJourneyStepContent
        {...rest}
        {...state}
        open={open}
        onClose={onClose}
        lastMedications={lastMedications}
      />
    </PatientWorkspaceOverlay>
  );
}

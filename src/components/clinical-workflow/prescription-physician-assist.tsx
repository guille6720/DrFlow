"use client";

import { InlinePhysicianAssist } from "@/components/clinical-workflow/inline-physician-assist";
import type { PhysicianAssistContext, PhysicianAssistItem } from "@/lib/utils/physician-assist-types";
import { useFeatureFlag } from "@/components/plugins/clinic-plugins-provider";

type Props = {
  context: PhysicianAssistContext;
  medicationNames: string[];
  onApplyPrescriptionNotes: (text: string) => void;
  onAlertGateChange?: (ready: boolean) => void;
};

export function PrescriptionPhysicianAssist({
  context,
  medicationNames,
  onApplyPrescriptionNotes,
  onAlertGateChange,
}: Props) {
  const enabled = useFeatureFlag("consultation_assistant");

  if (!enabled) return null;

  const assistContext: PhysicianAssistContext = {
    ...context,
    proposedMedications: medicationNames,
  };

  function handleApply(item: PhysicianAssistItem) {
    if (item.kind === "prescription_draft") {
      onApplyPrescriptionNotes(item.body);
    }
  }

  return (
    <InlinePhysicianAssist
      context={assistContext}
      kinds={["interaction_alert", "prescription_draft"]}
      onApply={handleApply}
      requireAlertAcknowledgement
      onAlertsAcknowledged={onAlertGateChange}
    />
  );
}

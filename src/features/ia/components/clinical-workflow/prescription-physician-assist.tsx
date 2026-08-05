"use client";

import { useMemo } from "react";

import { InlinePhysicianAssist } from "@/features/ia/components/clinical-workflow/inline-physician-assist";
import type { PhysicianAssistContext, PhysicianAssistItem } from "@/features/ia/types/physician-assist-types";
import { useFeatureFlag } from "@/features/plugins/components/plugins/clinic-features-provider";

type Props = {
  context: PhysicianAssistContext;
  medicationNames: string[];
  onApplyPrescriptionNotes: (text: string) => void;
  onAlertGateChange?: (ready: boolean) => void;
};

const RX_KINDS = [
  "interaction_alert",
  "coverage_note",
  "dosage_hint",
  "follow_up_reminder",
  "prescription_draft",
] as const;

/** Rx workflow — interactions, coverage, dosage hints, follow-up (Phase C). */
export function PrescriptionPhysicianAssist({
  context,
  medicationNames,
  onApplyPrescriptionNotes,
  onAlertGateChange,
}: Props) {
  const enabled = useFeatureFlag("consultation_assistant");

  const assistContext: PhysicianAssistContext = useMemo(
    () => ({
      ...context,
      proposedMedications: medicationNames,
    }),
    [context, medicationNames]
  );

  if (!enabled) return null;

  function handleApply(item: PhysicianAssistItem) {
    if (
      item.kind === "prescription_draft" ||
      item.kind === "coverage_note" ||
      item.kind === "dosage_hint" ||
      item.kind === "follow_up_reminder"
    ) {
      onApplyPrescriptionNotes(item.body);
    }
  }

  return (
    <InlinePhysicianAssist
      context={assistContext}
      kinds={[...RX_KINDS]}
      onApply={handleApply}
      requireAlertAcknowledgement
      onAlertsAcknowledged={onAlertGateChange}
    />
  );
}

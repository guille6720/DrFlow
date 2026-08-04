"use client";

import { useMemo } from "react";
import { InlinePhysicianAssist } from "@/features/ia/components/clinical-workflow/inline-physician-assist";
import type { PatientChartPayload } from "@/features/pacientes/utils/patient-chart-model-types";
import type { PhysicianAssistContext, PhysicianAssistItem } from "@/features/ia/types/physician-assist-types";
import { useFeatureFlag } from "@/features/plugins/components/plugins/clinic-plugins-provider";

type Props = {
  chart: PatientChartPayload;
  patientName: string;
  lastEvolution?: string | null;
  lastDiagnosis?: string | null;
};

/** Resumen tab — clinical summary assist with physician confirmation. */
export function ClinicalSummaryPhysicianAssist({
  chart,
  patientName,
  lastEvolution,
  lastDiagnosis,
}: Props) {
  const enabled = useFeatureFlag("consultation_assistant");

  const context: PhysicianAssistContext = useMemo(
    () => ({
      patientName,
      ageLabel: chart.ageLabel ?? undefined,
      sex: chart.sex,
      insurance: chart.insurance,
      allergies: chart.allergies.join(", ") || null,
      regularMedication: chart.medications.map((m) => m.name).join(", ") || null,
      activeProblems: chart.activeProblemsText,
      lastEvolution,
      lastDiagnosis,
    }),
    [chart, patientName, lastEvolution, lastDiagnosis]
  );

  if (!enabled) return null;

  function handleApply(item: PhysicianAssistItem) {
    if (item.kind === "clinical_summary" && typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(item.body);
    }
  }

  return (
    <InlinePhysicianAssist
      context={context}
      kinds={["clinical_summary", "interaction_alert", "differential"]}
      onApply={handleApply}
    />
  );
}

"use client";

import { useCallback, useMemo, useState } from "react";

import {
  canNavigateToJourneyStep,
  type ConsultationJourneyStepId,
  type ConsultationJourneyStepStatus,
  getConsultationJourneySteps,
  nextJourneyStepId,
} from "@/lib/utils/consultation-journey";

type Options = {
  enabled: boolean;
  canIssue: boolean;
};

export function useConsultationJourney({ enabled, canIssue }: Options) {
  const steps = useMemo(() => getConsultationJourneySteps(canIssue), [canIssue]);
  const [currentStep, setCurrentStep] = useState<ConsultationJourneyStepId>("evolution");
  const [clinicalRecordId, setClinicalRecordId] = useState<string | null>(null);
  const [stepStatus, setStepStatus] = useState<
    Partial<Record<ConsultationJourneyStepId, ConsultationJourneyStepStatus>>
  >({});

  const reset = useCallback(() => {
    setCurrentStep("evolution");
    setClinicalRecordId(null);
    setStepStatus({});
  }, []);

  const markStep = useCallback(
    (step: ConsultationJourneyStepId, status: Exclude<ConsultationJourneyStepStatus, "pending">) => {
      setStepStatus((prev) => ({ ...prev, [step]: status }));
      const next = nextJourneyStepId(steps, step);
      if (next) setCurrentStep(next);
    },
    [steps]
  );

  const onEvolutionSaved = useCallback(
    (recordId: string) => {
      setClinicalRecordId(recordId);
      markStep("evolution", "completed");
    },
    [markStep]
  );

  const completeStep = useCallback(
    (step: ConsultationJourneyStepId) => markStep(step, "completed"),
    [markStep]
  );

  const skipStep = useCallback(
    (step: ConsultationJourneyStepId) => markStep(step, "skipped"),
    [markStep]
  );

  const goToStep = useCallback(
    (step: ConsultationJourneyStepId) => {
      if (canNavigateToJourneyStep(steps, step, currentStep, stepStatus)) {
        setCurrentStep(step);
      }
    },
    [currentStep, stepStatus, steps]
  );

  return {
    enabled,
    steps,
    currentStep,
    clinicalRecordId,
    stepStatus,
    onEvolutionSaved,
    completeStep,
    skipStep,
    goToStep,
    reset,
  };
}

export type ConsultationJourneyState = ReturnType<typeof useConsultationJourney>;

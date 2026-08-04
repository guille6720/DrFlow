export type ConsultationJourneyStepId =
  | "evolution"
  | "prescription"
  | "order"
  | "follow_up"
  | "finish";

export type ConsultationJourneyStepStatus = "pending" | "completed" | "skipped";

export type ConsultationJourneyStepMeta = {
  id: ConsultationJourneyStepId;
  label: string;
  shortLabel: string;
};

export const CONSULTATION_JOURNEY_STEPS: ConsultationJourneyStepMeta[] = [
  { id: "evolution", label: "Evolución", shortLabel: "HC" },
  { id: "prescription", label: "Receta", shortLabel: "Rx" },
  { id: "order", label: "Orden", shortLabel: "Ord" },
  { id: "follow_up", label: "Próximo turno", shortLabel: "Turno" },
  { id: "finish", label: "Fin", shortLabel: "Fin" },
];

/** Steps shown when the physician can issue prescriptions and orders. */
export function getConsultationJourneySteps(canIssue: boolean): ConsultationJourneyStepMeta[] {
  if (canIssue) return CONSULTATION_JOURNEY_STEPS;
  return CONSULTATION_JOURNEY_STEPS.filter(
    (step) => step.id !== "prescription" && step.id !== "order"
  );
}

export function nextJourneyStepId(
  steps: ConsultationJourneyStepMeta[],
  current: ConsultationJourneyStepId
): ConsultationJourneyStepId | null {
  const index = steps.findIndex((step) => step.id === current);
  if (index < 0 || index >= steps.length - 1) return null;
  return steps[index + 1]!.id;
}

export function journeyStepIndex(
  steps: ConsultationJourneyStepMeta[],
  stepId: ConsultationJourneyStepId
): number {
  return steps.findIndex((step) => step.id === stepId);
}

export function canNavigateToJourneyStep(
  steps: ConsultationJourneyStepMeta[],
  target: ConsultationJourneyStepId,
  current: ConsultationJourneyStepId,
  status: Partial<Record<ConsultationJourneyStepId, ConsultationJourneyStepStatus>>
): boolean {
  const targetIndex = journeyStepIndex(steps, target);
  const currentIndex = journeyStepIndex(steps, current);
  if (targetIndex < 0 || currentIndex < 0) return false;
  if (targetIndex <= currentIndex) return true;
  for (let i = 0; i < targetIndex; i += 1) {
    const stepId = steps[i]!.id;
    if (stepId === "evolution") {
      if (status.evolution !== "completed") return false;
      continue;
    }
    if (status[stepId] == null || status[stepId] === "pending") return false;
  }
  return true;
}

export function journeyProgressPercent(
  steps: ConsultationJourneyStepMeta[],
  current: ConsultationJourneyStepId
): number {
  const index = journeyStepIndex(steps, current);
  if (index < 0) return 0;
  return Math.round(((index + 1) / steps.length) * 100);
}

export function journeyStepSubtitle(stepId: ConsultationJourneyStepId): string {
  switch (stepId) {
    case "evolution":
      return "Registrar evolución de la consulta";
    case "prescription":
      return "Emitir receta (opcional)";
    case "order":
      return "Generar orden médica (opcional)";
    case "follow_up":
      return "Agendar próximo control (opcional)";
    case "finish":
      return "Revisar y cerrar la consulta";
  }
}

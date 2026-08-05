import type { PhysicianAssistContext, PhysicianAssistItem } from "@/features/ia/types/physician-assist-types";

import {
  buildDischargeSummarySuggestion,
  buildMedicalCertificateDraft,
  buildPrescriptionDraftSuggestion,
} from "@/lib/utils/clinical-assistant";
import { buildFollowUpReminderItems, buildOrderDraftSuggestion } from "@/lib/utils/medication-order-assist";

export type CloseEncounterStepId =
  | "evolution_summary"
  | "prescription"
  | "order"
  | "certificate"
  | "follow_up"
  | "patient_instructions";

export type CloseEncounterStep = {
  id: CloseEncounterStepId;
  title: string;
  description: string;
  item: PhysicianAssistItem | null;
  optional?: boolean;
};

function buildPatientInstructionsItem(ctx: PhysicianAssistContext): PhysicianAssistItem | null {
  const diagnosis = (ctx.diagnosis ?? ctx.lastDiagnosis ?? "").trim();
  const evolution = (ctx.evolutionText ?? ctx.lastEvolution ?? "").trim();
  if (!diagnosis && !evolution) return null;

  const lines = [
    "Indicaciones para el paciente (revisar y personalizar):",
    "",
    diagnosis ? `Diagnóstico / motivo: ${diagnosis}` : null,
    "• Tomar medicación según prescripción médica.",
    "• Reconsultar si empeora el cuadro o aparecen signos de alarma.",
    "• Acudir a control en fecha acordada.",
    ctx.regularMedication?.trim()
      ? `• Continuar medicación habitual salvo indicación contraria: ${ctx.regularMedication.trim().slice(0, 160)}`
      : null,
  ].filter(Boolean);

  const body = lines.join("\n");
  return {
    id: `patient_instructions-${body.slice(0, 40).replace(/\s+/g, "-")}`,
    kind: "patient_instructions",
    title: "Indicaciones al paciente",
    body,
  };
}

function buildEvolutionSummaryItem(ctx: PhysicianAssistContext): PhysicianAssistItem | null {
  const discharge = buildDischargeSummarySuggestion(ctx);
  if (discharge) {
    return {
      ...discharge,
      id: `evolution_summary-${discharge.id}`,
      kind: "evolution_summary",
      title: "Resumen de evolución",
    };
  }

  const evolution = (ctx.evolutionText ?? ctx.lastEvolution ?? "").trim();
  if (!evolution) return null;

  return {
    id: `evolution_summary-${evolution.slice(0, 40)}`,
    kind: "evolution_summary",
    title: "Resumen de evolución",
    body: `Evolución de la consulta:\n${evolution.slice(0, 800)}`,
  };
}

/** Unified close-encounter wizard steps (Phase D). */
export function buildCloseEncounterSteps(ctx: PhysicianAssistContext): CloseEncounterStep[] {
  const followUpItems = buildFollowUpReminderItems(ctx);
  const followUpBody =
    followUpItems.length > 0
      ? followUpItems.map((i) => `• ${i.body}`).join("\n")
      : "• Control según criterio clínico.\n• Estudios pendientes según protocolo.";

  const followUpItem: PhysicianAssistItem = {
    id: "follow_up-bundle",
    kind: "follow_up_reminder",
    title: "Próximo control",
    body: followUpBody,
  };

  return [
    {
      id: "evolution_summary",
      title: "Evolución",
      description: "Resumen de la consulta para historia clínica.",
      item: buildEvolutionSummaryItem(ctx),
    },
    {
      id: "prescription",
      title: "Receta",
      description: "Borrador de medicación (si corresponde).",
      item: buildPrescriptionDraftSuggestion(ctx),
      optional: true,
    },
    {
      id: "order",
      title: "Orden médica",
      description: "Estudios o derivación sugeridos.",
      item: buildOrderDraftSuggestion(ctx),
      optional: true,
    },
    {
      id: "certificate",
      title: "Certificado",
      description: "Reposo o aptitud (si corresponde).",
      item: buildMedicalCertificateDraft(ctx),
      optional: true,
    },
    {
      id: "follow_up",
      title: "Próximo control",
      description: "Seguimiento y recordatorios clínicos.",
      item: followUpItem,
    },
    {
      id: "patient_instructions",
      title: "Indicaciones al paciente",
      description: "Texto para entregar al paciente.",
      item: buildPatientInstructionsItem(ctx),
    },
  ];
}

export function buildCloseEncounterBundleText(steps: CloseEncounterStep[]): string {
  return steps
    .filter((s) => s.item)
    .map((s) => `=== ${s.title} ===\n${s.item!.body}`)
    .join("\n\n");
}

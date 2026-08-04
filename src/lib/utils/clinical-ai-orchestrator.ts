import { buildPhysicianAssistItems } from "@/lib/utils/clinical-assistant";
import { buildCloseEncounterSteps, buildCloseEncounterBundleText } from "@/lib/utils/close-encounter-assist";
import {
  buildCopilotResponse,
  matchCopilotIntent,
  type ClinicalCopilotContext,
  type CopilotAction,
  type CopilotIntentId,
} from "@/lib/utils/clinical-copilot-responses";
import { buildConsultationDocumentationItems } from "@/lib/utils/consultation-documentation";
import { buildLabInterpretationItem } from "@/lib/utils/lab-interpretation";
import { buildMedicationOrderAssistItems } from "@/lib/utils/medication-order-assist";
import { buildPreVisitBrief } from "@/lib/utils/pre-visit-brief";
import {
  buildProactiveCareItems,
  buildProactiveCareSummaryText,
} from "@/lib/utils/proactive-follow-up";
import type { PatientChartPayload } from "@/lib/utils/patient-chart-types";
import {
  PHYSICIAN_ASSIST_DISCLAIMER,
  type PhysicianAssistContext,
  type PhysicianAssistItem,
  type PhysicianAssistKind,
} from "@/lib/utils/physician-assist-types";

/** Specialized clinical AI agents (Phase F architecture). */
export type ClinicalAiAgentId =
  | "pre_visit_agent"
  | "documentation_agent"
  | "medication_order_agent"
  | "lab_interpretation_agent"
  | "close_encounter_agent"
  | "proactive_followup_agent"
  | "copilot_agent";

export type ClinicalAiTask =
  | "pre_visit_brief"
  | "consultation_documentation"
  | "medication_order_assist"
  | "lab_interpretation"
  | "close_encounter"
  | "proactive_followup"
  | "copilot_query"
  | "clinical_summary"
  | "soap_draft";

export type ClinicalAiEngine = "rule_based" | "llm_enhanced";

export type ClinicalAiOrchestratorInput = {
  task: ClinicalAiTask;
  message?: string;
  patientId?: string;
  patientName?: string;
  chart?: PatientChartPayload;
  lastConsultAt?: string | null;
  assistContext?: PhysicianAssistContext;
  copilotContext?: ClinicalCopilotContext;
  labSourceText?: string;
  physicianAssistKinds?: PhysicianAssistKind[];
};

export type ClinicalAiOrchestratorResult = {
  agentId: ClinicalAiAgentId;
  task: ClinicalAiTask;
  title: string;
  body: string;
  items: PhysicianAssistItem[];
  actions: CopilotAction[];
  intent?: CopilotIntentId;
  engine: ClinicalAiEngine;
  disclaimer: string;
};

export const CLINICAL_AI_AGENT_LABELS: Record<ClinicalAiAgentId, string> = {
  pre_visit_agent: "Asistente pre-consulta",
  documentation_agent: "Asistente de documentación",
  medication_order_agent: "Asistente Rx / órdenes",
  lab_interpretation_agent: "Interpretación de laboratorio",
  close_encounter_agent: "Cierre de consulta",
  proactive_followup_agent: "Seguimiento proactivo",
  copilot_agent: "Copilot clínico",
};

const COPILOT_INTENT_AGENT: Record<CopilotIntentId, ClinicalAiAgentId> = {
  recent_consultations: "copilot_agent",
  repeat_prescription: "medication_order_agent",
  missing_studies: "medication_order_agent",
  patient_summary: "pre_visit_agent",
  pending_labs: "lab_interpretation_agent",
  proactive_alerts: "proactive_followup_agent",
  open_soap: "copilot_agent",
  open_close_wizard: "close_encounter_agent",
  open_labs: "lab_interpretation_agent",
  help: "copilot_agent",
};

const TASK_AGENT: Record<ClinicalAiTask, ClinicalAiAgentId> = {
  pre_visit_brief: "pre_visit_agent",
  consultation_documentation: "documentation_agent",
  medication_order_assist: "medication_order_agent",
  lab_interpretation: "lab_interpretation_agent",
  close_encounter: "close_encounter_agent",
  proactive_followup: "proactive_followup_agent",
  copilot_query: "copilot_agent",
  clinical_summary: "pre_visit_agent",
  soap_draft: "documentation_agent",
};

const DOCUMENTATION_KINDS: PhysicianAssistKind[] = [
  "evolution_draft",
  "physical_exam",
  "therapeutic_plan",
  "cie10_suggestion",
  "soap",
  "differential",
];

const MEDICATION_KINDS: PhysicianAssistKind[] = [
  "prescription_draft",
  "order_draft",
  "dosage_hint",
  "coverage_note",
  "follow_up_reminder",
  "interaction_alert",
];

export function resolveAgentForTask(task: ClinicalAiTask): ClinicalAiAgentId {
  return TASK_AGENT[task];
}

export function resolveAgentForCopilotIntent(intent: CopilotIntentId): ClinicalAiAgentId {
  return COPILOT_INTENT_AGENT[intent];
}

function itemsToBody(items: PhysicianAssistItem[]): string {
  if (items.length === 0) return "Sin sugerencias disponibles con la información actual.";
  return items.map((i) => `[${i.title}]\n${i.body}`).join("\n\n");
}

function runPreVisitAgent(input: ClinicalAiOrchestratorInput): ClinicalAiOrchestratorResult {
  if (!input.chart || !input.patientName) {
    return {
      agentId: "pre_visit_agent",
      task: input.task,
      title: "Resumen pre-consulta",
      body: "Faltan datos de ficha clínica para generar el resumen.",
      items: [],
      actions: [],
      engine: "rule_based",
      disclaimer: PHYSICIAN_ASSIST_DISCLAIMER,
    };
  }

  const brief = buildPreVisitBrief({
    patientName: input.patientName,
    chart: input.chart,
    lastConsultAt: input.lastConsultAt,
  });

  return {
    agentId: "pre_visit_agent",
    task: input.task,
    title: "Resumen pre-consulta",
    body: brief.plainText,
    items: [],
    actions: [{ label: "Copiar resumen", copyText: brief.plainText }],
    engine: "rule_based",
    disclaimer: PHYSICIAN_ASSIST_DISCLAIMER,
  };
}

function runDocumentationAgent(input: ClinicalAiOrchestratorInput): ClinicalAiOrchestratorResult {
  const ctx = input.assistContext ?? {};
  const kinds = input.physicianAssistKinds ?? DOCUMENTATION_KINDS;
  const items = buildConsultationDocumentationItems(ctx, kinds);
  const soapItems = buildPhysicianAssistItems(ctx, kinds.filter((k) => k === "soap" || k === "differential"));
  const merged = [...items, ...soapItems.filter((i) => !items.some((x) => x.id === i.id))];

  return {
    agentId: "documentation_agent",
    task: input.task,
    title: "Documentación clínica sugerida",
    body: itemsToBody(merged),
    items: merged,
    actions: merged.slice(0, 3).map((i) => ({ label: `Copiar: ${i.title}`, copyText: i.body })),
    engine: "rule_based",
    disclaimer: PHYSICIAN_ASSIST_DISCLAIMER,
  };
}

function runMedicationOrderAgent(input: ClinicalAiOrchestratorInput): ClinicalAiOrchestratorResult {
  const ctx = input.assistContext ?? {};
  const kinds = input.physicianAssistKinds ?? MEDICATION_KINDS;
  const items = buildMedicationOrderAssistItems(ctx, kinds);
  const rxItems = buildPhysicianAssistItems(ctx, kinds.filter((k) => k === "prescription_draft" || k === "order_draft"));
  const merged = [...items, ...rxItems.filter((i) => !items.some((x) => x.id === i.id))];

  return {
    agentId: "medication_order_agent",
    task: input.task,
    title: "Receta y órdenes sugeridas",
    body: itemsToBody(merged),
    items: merged,
    actions: merged.slice(0, 3).map((i) => ({ label: `Copiar: ${i.title}`, copyText: i.body })),
    engine: "rule_based",
    disclaimer: PHYSICIAN_ASSIST_DISCLAIMER,
  };
}

function runLabAgent(input: ClinicalAiOrchestratorInput): ClinicalAiOrchestratorResult {
  const item = input.labSourceText
    ? buildLabInterpretationItem({
        sourceText: input.labSourceText,
        previousLabs: input.chart?.extras.labs,
      })
    : null;

  const items = item ? [item] : [];

  return {
    agentId: "lab_interpretation_agent",
    task: input.task,
    title: "Interpretación de laboratorio",
    body: item?.body ?? "Pegá texto de laboratorio para interpretar.",
    items,
    actions: item ? [{ label: "Copiar resumen", copyText: item.body }] : [],
    engine: "rule_based",
    disclaimer: PHYSICIAN_ASSIST_DISCLAIMER,
  };
}

function runCloseEncounterAgent(input: ClinicalAiOrchestratorInput): ClinicalAiOrchestratorResult {
  const ctx = input.assistContext ?? { patientName: input.patientName };
  const steps = buildCloseEncounterSteps(ctx);
  const body = buildCloseEncounterBundleText(steps);
  const items = steps.filter((s) => s.item).map((s) => s.item!);

  return {
    agentId: "close_encounter_agent",
    task: input.task,
    title: "Paquete de cierre de consulta",
    body: body || "Sin borradores de cierre con la información actual.",
    items,
    actions: [{ label: "Copiar paquete", copyText: body }],
    engine: "rule_based",
    disclaimer: PHYSICIAN_ASSIST_DISCLAIMER,
  };
}

function runProactiveAgent(input: ClinicalAiOrchestratorInput): ClinicalAiOrchestratorResult {
  if (!input.chart || !input.patientId) {
    return {
      agentId: "proactive_followup_agent",
      task: input.task,
      title: "Seguimiento proactivo",
      body: "Faltan datos de paciente para alertas proactivas.",
      items: [],
      actions: [],
      engine: "rule_based",
      disclaimer: PHYSICIAN_ASSIST_DISCLAIMER,
    };
  }

  const careItems = buildProactiveCareItems({
    patientId: input.patientId,
    chart: input.chart,
    lastConsultAt: input.lastConsultAt,
  });
  const body = buildProactiveCareSummaryText(careItems);

  return {
    agentId: "proactive_followup_agent",
    task: input.task,
    title: "Seguimiento proactivo",
    body,
    items: [],
    actions: careItems
      .slice(0, 4)
      .filter((i) => i.actionHref)
      .map((i) => ({ label: i.actionLabel ?? i.title, href: i.actionHref })),
    engine: "rule_based",
    disclaimer: PHYSICIAN_ASSIST_DISCLAIMER,
  };
}

function runCopilotAgent(input: ClinicalAiOrchestratorInput): ClinicalAiOrchestratorResult {
  const ctx = input.copilotContext ?? {
    patientId: input.patientId,
    patientName: input.patientName,
    chart: input.chart,
    lastConsultAt: input.lastConsultAt,
    assistContext: input.assistContext,
  };
  const message = input.message ?? "";
  const intent = matchCopilotIntent(message);
  const agentId = resolveAgentForCopilotIntent(intent);
  const response = buildCopilotResponse(intent, ctx);

  return {
    agentId,
    task: "copilot_query",
    title: response.title,
    body: response.body,
    items: [],
    actions: response.actions,
    intent: response.intent,
    engine: "rule_based",
    disclaimer: PHYSICIAN_ASSIST_DISCLAIMER,
  };
}

/** Unified clinical AI orchestrator — routes to specialized agents (Phase F). */
export function runClinicalAiOrchestrator(
  input: ClinicalAiOrchestratorInput
): ClinicalAiOrchestratorResult {
  switch (input.task) {
    case "pre_visit_brief":
    case "clinical_summary":
      return runPreVisitAgent(input);
    case "consultation_documentation":
    case "soap_draft":
      return runDocumentationAgent(input);
    case "medication_order_assist":
      return runMedicationOrderAgent(input);
    case "lab_interpretation":
      return runLabAgent(input);
    case "close_encounter":
      return runCloseEncounterAgent(input);
    case "proactive_followup":
      return runProactiveAgent(input);
    case "copilot_query":
      return runCopilotAgent(input);
    default:
      return runCopilotAgent({ ...input, task: "copilot_query" });
  }
}

export function listClinicalAiAgents(): Array<{ id: ClinicalAiAgentId; label: string }> {
  return (Object.keys(CLINICAL_AI_AGENT_LABELS) as ClinicalAiAgentId[]).map((id) => ({
    id,
    label: CLINICAL_AI_AGENT_LABELS[id],
  }));
}

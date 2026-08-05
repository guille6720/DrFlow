import type { PhysicianAssistContext } from "@/features/ia/types/physician-assist-types";
import type { PatientChartPayload } from "@/features/pacientes/utils/patient-chart-model-types";

import { buildCopilotResponseForIntent } from "@/lib/utils/clinical-copilot-response-builders";

export type CopilotIntentId =
  | "recent_consultations"
  | "repeat_prescription"
  | "missing_studies"
  | "patient_summary"
  | "pending_labs"
  | "proactive_alerts"
  | "open_soap"
  | "open_close_wizard"
  | "open_labs"
  | "help";

export type CopilotAction = {
  label: string;
  href?: string;
  copyText?: string;
};

export type CopilotResponse = {
  intent: CopilotIntentId;
  title: string;
  body: string;
  actions: CopilotAction[];
};

export type ClinicalCopilotContext = {
  patientId?: string;
  patientName?: string;
  chart?: PatientChartPayload;
  lastConsultAt?: string | null;
  recentConsultations?: { dateLabel: string; motive: string; diagnosis: string }[];
  lastPrescriptionLines?: string[];
  assistContext?: PhysicianAssistContext;
};

type IntentRule = {
  id: CopilotIntentId;
  patterns: RegExp[];
};

const INTENT_RULES: IntentRule[] = [
  {
    id: "recent_consultations",
    patterns: [/ultim[aá]s?\s+\d*\s*consultas?/i, /mostr[aá].*consultas?/i, /historial\s+reciente/i],
  },
  {
    id: "repeat_prescription",
    patterns: [/receta\s+(igual|anterior|previa)/i, /repetir\s+receta/i, /misma\s+receta/i],
  },
  {
    id: "missing_studies",
    patterns: [/estudios?\s+falt/i, /control\s+anual/i, /qu[eé]\s+estudios/i, /panel\s+diabetes/i],
  },
  {
    id: "patient_summary",
    patterns: [/resumen/i, /brief/i, /contexto\s+cl/i],
  },
  {
    id: "pending_labs",
    patterns: [/lab(oratorio)?s?\s+pend/i, /hba1c/i, /estudios?\s+pend/i],
  },
  {
    id: "proactive_alerts",
    patterns: [/alertas?/i, /seguimiento/i, /proactiv/i, /atenci[oó]n\s+requerida/i],
  },
  {
    id: "open_soap",
    patterns: [/nueva\s+soap/i, /abrir\s+soap/i, /evoluci[oó]n/i],
  },
  {
    id: "open_close_wizard",
    patterns: [/cerrar\s+consulta/i, /generar\s+cierre/i, /cierre\s+de\s+consulta/i],
  },
  {
    id: "open_labs",
    patterns: [/interpretar\s+lab/i, /ocr/i, /pegar\s+lab/i],
  },
];

/** Match user message to a copilot intent (rule-based). */
export function matchCopilotIntent(message: string): CopilotIntentId {
  const trimmed = message.trim();
  if (!trimmed) return "help";

  for (const rule of INTENT_RULES) {
    if (rule.patterns.some((p) => p.test(trimmed))) return rule.id;
  }

  return "help";
}

function requirePatient(ctx: ClinicalCopilotContext): CopilotResponse | null {
  if (ctx.patientId && ctx.patientName) return null;
  return {
    intent: "help",
    title: "Seleccioná un paciente",
    body: "Abrí la ficha de un paciente para usar el copilot clínico con contexto completo.\n\nPodés buscar en Pacientes o usar la paleta de comandos (Ctrl+K).",
    actions: [{ label: "Ir a pacientes", href: "/pacientes" }],
  };
}

/** Context-aware suggested prompts for empty copilot state. */
export function buildCopilotSuggestedPrompts(ctx: ClinicalCopilotContext): string[] {
  if (!ctx.patientId) {
    return ["Buscar paciente en Pacientes", "Abrir agenda del día"];
  }
  return [
    "Mostrame las últimas tres consultas",
    "Generá una receta igual a la anterior",
    "¿Qué estudios faltan para el control anual?",
    "Resumen del paciente",
    "Alertas de seguimiento",
  ];
}

/** Build copilot response for matched intent. */
export function buildCopilotResponse(
  intent: CopilotIntentId,
  ctx: ClinicalCopilotContext
): CopilotResponse {
  const missing = requirePatient(ctx);
  if (missing && intent !== "help") return missing;

  return buildCopilotResponseForIntent(intent, ctx, ctx.patientId!, buildCopilotSuggestedPrompts(ctx));
}

import { buildPreVisitBrief } from "@/lib/utils/pre-visit-brief";
import { buildPrescriptionDraftSuggestion } from "@/lib/utils/clinical-assistant";
import { buildOrderDraftSuggestion } from "@/lib/utils/medication-order-assist";
import { buildProactiveCareItems } from "@/lib/utils/proactive-follow-up";
import type { PatientChartPayload } from "@/lib/utils/patient-chart-types";
import { buildPatientWorkspaceUrl } from "@/lib/utils/patient-workspace-actions";
import type { PhysicianAssistContext } from "@/lib/utils/physician-assist-types";
import { PHYSICIAN_ASSIST_DISCLAIMER } from "@/lib/utils/physician-assist-types";

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

/** Match user message to a copilot intent (rule-based, Phase E). */
export function matchCopilotIntent(message: string): CopilotIntentId {
  const trimmed = message.trim();
  if (!trimmed) return "help";

  for (const rule of INTENT_RULES) {
    if (rule.patterns.some((p) => p.test(trimmed))) return rule.id;
  }

  return "help";
}

function patientHref(patientId: string, opts: Parameters<typeof buildPatientWorkspaceUrl>[1]) {
  return buildPatientWorkspaceUrl(patientId, opts);
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

/** Build copilot response for matched intent. */
export function buildCopilotResponse(
  intent: CopilotIntentId,
  ctx: ClinicalCopilotContext
): CopilotResponse {
  const missing = requirePatient(ctx);
  if (missing && intent !== "help") return missing;

  const pid = ctx.patientId!;

  switch (intent) {
    case "recent_consultations": {
      const rows = ctx.recentConsultations ?? [];
      if (rows.length === 0) {
        return {
          intent,
          title: "Consultas recientes",
          body: "No hay consultas registradas para este paciente.",
          actions: [{ label: "Nueva SOAP", href: patientHref(pid, { tab: "soap", action: "nueva" }) }],
        };
      }
      const body = rows
        .slice(0, 3)
        .map((c, i) => `${i + 1}. ${c.dateLabel} — ${c.motive}\n   Dx: ${c.diagnosis}`)
        .join("\n\n");
      return {
        intent,
        title: "Últimas consultas",
        body,
        actions: [
          { label: "Ver timeline", href: patientHref(pid, { tab: "timeline" }) },
          { label: "Copiar", copyText: body },
        ],
      };
    }

    case "repeat_prescription": {
      const lines = ctx.lastPrescriptionLines ?? [];
      const draft = ctx.assistContext
        ? buildPrescriptionDraftSuggestion(ctx.assistContext)
        : null;
      const rxBody =
        lines.length > 0
          ? `Medicación de la última receta:\n${lines.map((l) => `• ${l}`).join("\n")}\n\nRevisar dosis, interacciones y cobertura antes de emitir.`
          : draft?.body ??
            "No hay receta previa registrada. Podés armar un borrador desde la asistencia de recetas.";
      return {
        intent,
        title: "Receta basada en la anterior",
        body: rxBody,
        actions: [
          { label: "Abrir receta", href: patientHref(pid, { tab: "recetas", action: "nueva" }) },
          { label: "Copiar borrador", copyText: rxBody },
        ],
      };
    }

    case "missing_studies": {
      const orderCtx: PhysicianAssistContext = {
        ...(ctx.assistContext ?? {}),
        orderIntentText: "control anual diabetes",
        patientName: ctx.patientName,
      };
      const order = buildOrderDraftSuggestion(orderCtx);
      const body =
        order?.body ??
        "No se detectó panel específico. Sugerencia genérica:\n• HbA1c\n• Glucemia\n• Perfil lipídico\n• Creatinina\n• Microalbuminuria";
      return {
        intent,
        title: "Estudios sugeridos para control",
        body,
        actions: [
          { label: "Abrir orden", href: patientHref(pid, { tab: "ordenes", action: "nueva" }) },
          { label: "Copiar", copyText: body },
        ],
      };
    }

    case "patient_summary": {
      if (!ctx.chart || !ctx.patientName) {
        return {
          intent,
          title: "Resumen clínico",
          body: "No hay datos de chart disponibles.",
          actions: [],
        };
      }
      const brief = buildPreVisitBrief({
        patientName: ctx.patientName,
        chart: ctx.chart,
        lastConsultAt: ctx.lastConsultAt,
      });
      return {
        intent,
        title: "Resumen del paciente",
        body: brief.plainText,
        actions: [{ label: "Copiar resumen", copyText: brief.plainText }],
      };
    }

    case "pending_labs":
    case "proactive_alerts": {
      if (!ctx.chart) {
        return { intent, title: "Alertas", body: "Sin datos de ficha.", actions: [] };
      }
      const items = buildProactiveCareItems({
        patientId: pid,
        chart: ctx.chart,
        lastConsultAt: ctx.lastConsultAt,
      });
      const body =
        items.length > 0
          ? items.map((i) => `• ${i.title}\n  ${i.detail}`).join("\n\n")
          : "No se detectaron alertas proactivas con la información actual.";
      return {
        intent,
        title: "Seguimiento proactivo",
        body,
        actions: items
          .slice(0, 3)
          .filter((i) => i.actionHref)
          .map((i) => ({ label: i.actionLabel ?? "Ver", href: i.actionHref })),
      };
    }

    case "open_soap":
      return {
        intent,
        title: "Nueva consulta SOAP",
        body: "Te llevo al formulario de nueva evolución para este paciente.",
        actions: [{ label: "Abrir SOAP", href: patientHref(pid, { tab: "soap", action: "nueva" }) }],
      };

    case "open_close_wizard":
      return {
        intent,
        title: "Wizard de cierre",
        body: "Generá evolución, receta, orden, certificado e indicaciones en un solo flujo revisable.",
        actions: [{ label: "Generar cierre", href: patientHref(pid, { action: "cerrar" }) }],
      };

    case "open_labs":
      return {
        intent,
        title: "Interpretación de laboratorio",
        body: "Pegá texto de OCR/PDF para comparar con la historia y detectar valores fuera de rango.",
        actions: [
          { label: "Abrir labs", href: patientHref(pid, { tab: "estudios", action: "estudio" }) },
        ],
      };

    case "help":
    default:
      return {
        intent: "help",
        title: "Copilot clínico",
        body: `Preguntame, por ejemplo:\n${buildCopilotSuggestedPrompts(ctx)
          .map((p) => `• "${p}"`)
          .join("\n")}\n\n${PHYSICIAN_ASSIST_DISCLAIMER}`,
        actions: ctx.patientId
          ? [{ label: "Resumen del paciente", copyText: "resumen" }]
          : [{ label: "Ir a pacientes", href: "/pacientes" }],
      };
  }
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

export function runClinicalCopilotQuery(
  message: string,
  ctx: ClinicalCopilotContext
): CopilotResponse {
  const intent = matchCopilotIntent(message);
  return buildCopilotResponse(intent, ctx);
}

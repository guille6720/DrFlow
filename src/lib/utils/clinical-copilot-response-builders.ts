import type { PhysicianAssistContext } from "@/features/ia/types/physician-assist-types";
import { PHYSICIAN_ASSIST_DISCLAIMER } from "@/features/ia/types/physician-assist-types";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

import { buildPrescriptionDraftSuggestion } from "@/lib/utils/clinical-assistant";
import type {
  ClinicalCopilotContext,
  CopilotIntentId,
  CopilotResponse,
} from "@/lib/utils/clinical-copilot-responses";
import { buildOrderDraftSuggestion } from "@/lib/utils/medication-order-assist";
import { buildPreVisitBrief } from "@/lib/utils/pre-visit-brief";
import { buildProactiveCareItems } from "@/lib/utils/proactive-follow-up";

function patientHref(patientId: string, opts: Parameters<typeof buildPatientWorkspaceUrl>[1]) {
  return buildPatientWorkspaceUrl(patientId, opts);
}

export function buildRecentConsultationsResponse(
  intent: CopilotIntentId,
  ctx: ClinicalCopilotContext,
  pid: string
): CopilotResponse {
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

export function buildRepeatPrescriptionResponse(
  intent: CopilotIntentId,
  ctx: ClinicalCopilotContext,
  pid: string
): CopilotResponse {
  const lines = ctx.lastPrescriptionLines ?? [];
  const draft = ctx.assistContext ? buildPrescriptionDraftSuggestion(ctx.assistContext) : null;
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

export function buildMissingStudiesResponse(
  intent: CopilotIntentId,
  ctx: ClinicalCopilotContext,
  pid: string
): CopilotResponse {
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

export function buildPatientSummaryResponse(
  intent: CopilotIntentId,
  ctx: ClinicalCopilotContext
): CopilotResponse {
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

export function buildProactiveAlertsResponse(
  intent: CopilotIntentId,
  ctx: ClinicalCopilotContext,
  pid: string
): CopilotResponse {
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

export function buildCopilotResponseForIntent(
  intent: CopilotIntentId,
  ctx: ClinicalCopilotContext,
  pid: string,
  suggestedPrompts: string[]
): CopilotResponse {
  switch (intent) {
    case "recent_consultations":
      return buildRecentConsultationsResponse(intent, ctx, pid);
    case "repeat_prescription":
      return buildRepeatPrescriptionResponse(intent, ctx, pid);
    case "missing_studies":
      return buildMissingStudiesResponse(intent, ctx, pid);
    case "patient_summary":
      return buildPatientSummaryResponse(intent, ctx);
    case "pending_labs":
    case "proactive_alerts":
      return buildProactiveAlertsResponse(intent, ctx, pid);
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
        body: `Preguntame, por ejemplo:\n${suggestedPrompts
          .map((p) => `• "${p}"`)
          .join("\n")}\n\n${PHYSICIAN_ASSIST_DISCLAIMER}`,
        actions: ctx.patientId
          ? [{ label: "Resumen del paciente", copyText: "resumen" }]
          : [{ label: "Ir a pacientes", href: "/pacientes" }],
      };
  }
}

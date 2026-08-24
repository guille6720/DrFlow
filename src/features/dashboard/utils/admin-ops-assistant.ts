import { isHrefEntitledBySnapshot } from "@/core/entitlements/nav-features";

import {
  ADMIN_OPS_DISCLAIMER,
  ANALYTICS_INTENTS,
  buildAdminOpsResponseForIntent,
  buildAdminOpsSuggestedPromptsForHelp,
  OPS_INTENTS,
} from "@/features/dashboard/utils/admin-ops-response-builders";
import type {
  AdminOpsAction,
  AdminOpsContext,
  AdminOpsIntentId,
  AdminOpsResponse,
} from "@/features/dashboard/utils/admin-ops-types";

export type { AdminOpsAction, AdminOpsIntentId, AdminOpsResponse };

type IntentRule = {
  id: AdminOpsIntentId;
  patterns: RegExp[];
};

const INTENT_RULES: IntentRule[] = [
  {
    id: "daily_ops_summary",
    patterns: [/resumen\s+(del\s+)?d[ií]a/i, /operaciones\s+de\s+hoy/i, /estado\s+general/i, /c[oó]mo\s+est[aá]\s+el\s+d[ií]a/i],
  },
  {
    id: "waiting_queue",
    patterns: [/cola\s+de\s+espera/i, /pacientes?\s+en\s+espera/i, /sala\s+de\s+espera/i, /qui[eé]n\s+espera/i, /en\s+espera/i],
  },
  {
    id: "overdue_appointments",
    patterns: [/turnos?\s+demor/i, /atrasad/i, /overdue/i, /sin\s+atender/i],
  },
  {
    id: "pending_prescriptions",
    patterns: [/recetas?\s+(borrador|pendiente)/i, /emitir\s+receta/i, /rx\s+pend/i],
  },
  {
    id: "pending_studies",
    patterns: [/estudios?\s+pend/i, /adjuntos?\s+pend/i, /revisar\s+estudio/i],
  },
  {
    id: "tasks_list",
    patterns: [/tareas?\s+pend/i, /pendientes?\s+del\s+d[ií]a/i, /qu[eé]\s+hacer/i, /^todo\b/i],
  },
  {
    id: "notifications",
    patterns: [/notificaciones?/i, /alertas?\s+operativ/i, /ausentes?/i, /cancelad/i],
  },
  {
    id: "revenue_today",
    patterns: [
      /ingresos?\s+(de\s+)?hoy/i,
      /cu[aá]nto\s+cobr/i,
      /cobros?\s+(de\s+)?hoy/i,
      /facturaci[oó]n\s+de\s+hoy/i,
    ],
  },
  {
    id: "revenue_month",
    patterns: [/ingresos?\s+del\s+mes/i, /facturaci[oó]n\s+mensual/i, /total\s+del\s+mes/i],
  },
  {
    id: "payment_breakdown",
    patterns: [/m[eé]todo\s+de\s+pago/i, /desglose/i, /por\s+forma\s+de\s+pago/i, /efectivo\s+y\s+transfer/i],
  },
  {
    id: "closure_status",
    patterns: [/estado\s+(del\s+)?cierre/i, /caja\s+cerrada/i, /cierre\s+realizado/i],
  },
  {
    id: "authorizations_list",
    patterns: [/autorizaciones?/i, /documentos?\s+de\s+autoriz/i, /copago\s+autorizado/i],
  },
  {
    id: "copago_summary",
    patterns: [/copagos?/i, /coseguros?/i, /obra\s+social\s+cobr/i],
  },
  {
    id: "open_waiting_room",
    patterns: [/abrir\s+sala/i, /ir\s+a\s+sala/i, /gestionar\s+espera/i],
  },
  {
    id: "open_agenda",
    patterns: [/agenda\s+del\s+d[ií]a/i, /ver\s+agenda/i, /turnos?\s+de\s+hoy/i],
  },
  {
    id: "open_caja",
    patterns: [/abrir\s+caja/i, /ir\s+a\s+caja/i],
  },
  {
    id: "cash_help",
    patterns: [/cerrar\s+caja/i, /cuenta\s+corriente/i, /registrar\s+cobro/i, /factura/i, /ledger/i],
  },
  {
    id: "admin_help",
    patterns: [/ayuda/i, /help/i, /qu[eé]\s+puedo/i, /c[oó]mo\s+funciona/i],
  },
];

export function matchAdminOpsIntent(message: string): AdminOpsIntentId {
  const trimmed = message.trim();
  if (!trimmed) return "admin_help";

  for (const rule of INTENT_RULES) {
    if (rule.patterns.some((p) => p.test(trimmed))) return rule.id;
  }

  return "admin_help";
}

function requireOps(ctx: AdminOpsContext): AdminOpsResponse | null {
  if (ctx.ops) return null;
  return {
    intent: "admin_help",
    title: "Sin datos operativos",
    body: "Abrí el dashboard de operaciones para cargar cola, tareas y pendientes del día.\n\nTambién podés ir directo a Sala de espera, Agenda o Caja.",
    actions: [
      { label: "Ir al dashboard", href: "/dashboard" },
      { label: "Sala de espera", href: "/sala-espera" },
    ],
  };
}

function requireAnalytics(ctx: AdminOpsContext): AdminOpsResponse | null {
  if (ctx.analytics) return null;
  return {
    intent: "admin_help",
    title: "Sin datos de caja",
    body:
      ctx.canManageCash === false
        ? "La caja no está incluida en el plan del consultorio."
        : "Abrí Caja o Reportes de caja para cargar ingresos y autorizaciones del período.",
    actions:
      ctx.canManageCash === false
        ? [{ label: "Ir al dashboard", href: "/dashboard" }]
        : [
            { label: "Ir a caja", href: "/caja" },
            { label: "Reportes de caja", href: "/caja/reportes" },
          ],
  };
}

function filterAdminOpsActions(actions: AdminOpsAction[], ctx: AdminOpsContext): AdminOpsAction[] {
  return actions.filter((action) => {
    if (!action.href) return true;
    if (ctx.canManageCash === false && (action.href === "/caja" || action.href.startsWith("/caja/"))) {
      return false;
    }
    return isHrefEntitledBySnapshot(action.href, ctx.entitlementsSnapshot ?? null);
  });
}

/** Context-aware suggested prompts for empty admin ops copilot. */
export function buildAdminOpsSuggestedPrompts(ctx: AdminOpsContext): string[] {
  return buildAdminOpsSuggestedPromptsForHelp(ctx);
}

/** Build admin/ops response for matched intent (Phase G/H — rule-based). */
export function buildAdminOpsResponse(intent: AdminOpsIntentId, ctx: AdminOpsContext): AdminOpsResponse {
  let response: AdminOpsResponse;
  if (intent === "daily_ops_summary" && !ctx.ops && !ctx.analytics) {
    response = requireOps(ctx)!;
  } else if (ANALYTICS_INTENTS.includes(intent)) {
    const missing = requireAnalytics(ctx);
    response = missing ?? buildAdminOpsResponseForIntent(intent, ctx);
  } else if (OPS_INTENTS.includes(intent)) {
    const missing = requireOps(ctx);
    response = missing ?? buildAdminOpsResponseForIntent(intent, ctx);
  } else {
    response = buildAdminOpsResponseForIntent(intent, ctx);
  }

  return { ...response, actions: filterAdminOpsActions(response.actions ?? [], ctx) };
}

export { ADMIN_OPS_DISCLAIMER };

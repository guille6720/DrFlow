import type { AdminOpsContext, AdminOpsSnapshot } from "@/features/dashboard/utils/admin-ops-types";
import {
  formatBreakdownLines,
  formatCurrencyAr,
  type AdminAnalyticsSnapshot,
} from "@/lib/utils/admin-analytics-types";

export type AdminOpsIntentId =
  | "daily_ops_summary"
  | "waiting_queue"
  | "overdue_appointments"
  | "pending_prescriptions"
  | "pending_studies"
  | "tasks_list"
  | "notifications"
  | "revenue_today"
  | "revenue_month"
  | "payment_breakdown"
  | "closure_status"
  | "authorizations_list"
  | "copago_summary"
  | "open_waiting_room"
  | "open_agenda"
  | "open_caja"
  | "cash_help"
  | "admin_help";

export type AdminOpsAction = {
  label: string;
  href?: string;
  copyText?: string;
};

export type AdminOpsResponse = {
  intent: AdminOpsIntentId;
  title: string;
  body: string;
  actions: AdminOpsAction[];
};

const ADMIN_OPS_DISCLAIMER =
  "Asistencia operativa — verificá datos y confirmá acciones antes de ejecutarlas.";

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

function formatWaitingBody(ops: AdminOpsSnapshot): string {
  if (ops.waiting.length === 0) return "No hay pacientes en cola de atención.";
  return ops.waiting
    .map((w, i) => `${i + 1}. ${w.name} — ${w.time} hs · ${w.status}`)
    .join("\n");
}

function formatTasksBody(ops: AdminOpsSnapshot): string {
  if (ops.tasks.length === 0) return "No hay tareas pendientes registradas.";
  return ops.tasks
    .map((t, i) => {
      const badge = t.priority === "high" ? " [urgente]" : "";
      return `${i + 1}. ${t.label}${badge}\n   ${t.detail}`;
    })
    .join("\n\n");
}

function formatNotificationsBody(ops: AdminOpsSnapshot): string {
  if (ops.notifications.length === 0) return "No hay notificaciones operativas.";
  return ops.notifications.map((n) => `• ${n.label} — ${n.patientName}`).join("\n");
}

function requireAnalytics(ctx: AdminOpsContext): AdminOpsResponse | null {
  if (ctx.analytics) return null;
  return {
    intent: "admin_help",
    title: "Sin datos de caja",
    body: "Abrí Caja o Reportes de caja para cargar ingresos y autorizaciones del período.",
    actions: [
      { label: "Ir a caja", href: "/caja" },
      { label: "Reportes de caja", href: "/caja/reportes" },
    ],
  };
}

function formatAuthorizationsBody(analytics: AdminAnalyticsSnapshot): string {
  if (analytics.authorizationCount === 0) {
    return "No hay documentos de autorización registrados.";
  }
  const header = `${analytics.authorizationCount} autorización(es) en el consultorio.\n\nRecientes:`;
  const rows = analytics.recentAuthorizations
    .map((a) => `• ${a.patientName} — ${a.title}`)
    .join("\n");
  return rows ? `${header}\n${rows}` : header;
}

function buildDailySummary(ops?: AdminOpsSnapshot, analytics?: AdminAnalyticsSnapshot): string {
  const lines: string[] = [];
  if (ops) {
    lines.push(
      `Cola de espera: ${ops.waitingCount} paciente(s)`,
      `Turnos demorados: ${ops.overdueCount}`,
      `Recetas borrador: ${ops.draftPrescriptionsCount}`,
      `Estudios por revisar: ${ops.pendingStudiesCount}`,
      `Tareas pendientes: ${ops.tasksCount} (${ops.highPriorityTasksCount} urgentes)`,
      `Notificaciones: ${ops.notificationsCount}`
    );
    if (ops.criticalPatientsCount > 0) {
      lines.push(`Pacientes con alerta crítica: ${ops.criticalPatientsCount}`);
    }
  }
  if (analytics) {
    lines.push(
      `Ingresos hoy: ${formatCurrencyAr(analytics.todayTotal)} (${analytics.todayChargeCount} cobros)`,
      `Ingresos del mes: ${formatCurrencyAr(analytics.monthTotal)}`,
      `Cierre de caja: ${analytics.closureClosedToday ? "realizado" : "pendiente"}`
    );
  }
  if (lines.length === 0) return "Sin datos operativos ni de caja disponibles.";
  return lines.join("\n");
}

/** Context-aware suggested prompts for empty admin ops copilot. */
export function buildAdminOpsSuggestedPrompts(ctx: AdminOpsContext): string[] {
  const prompts: string[] = [];
  if (ctx.analytics) {
    prompts.push("Ingresos de hoy", "Desglose por método de pago", "Autorizaciones");
  }
  if (ctx.ops) {
    prompts.push("Resumen del día", "¿Quién está en espera?", "Tareas pendientes");
  }
  if (prompts.length === 0) {
    return ["Resumen del día", "Ingresos de hoy", "Ayuda de caja"];
  }
  return prompts.slice(0, 5);
}

/** Build admin/ops response for matched intent (Phase G/H — rule-based). */
export function buildAdminOpsResponse(intent: AdminOpsIntentId, ctx: AdminOpsContext): AdminOpsResponse {
  const ANALYTICS_INTENTS: AdminOpsIntentId[] = [
    "revenue_today",
    "revenue_month",
    "payment_breakdown",
    "closure_status",
    "authorizations_list",
    "copago_summary",
  ];

  const OPS_INTENTS: AdminOpsIntentId[] = [
    "waiting_queue",
    "overdue_appointments",
    "pending_prescriptions",
    "pending_studies",
    "tasks_list",
    "notifications",
  ];

  if (intent === "daily_ops_summary" && !ctx.ops && !ctx.analytics) {
    return requireOps(ctx)!;
  }

  if (ANALYTICS_INTENTS.includes(intent)) {
    const missing = requireAnalytics(ctx);
    if (missing) return missing;
  }

  if (OPS_INTENTS.includes(intent)) {
    const missing = requireOps(ctx);
    if (missing) return missing;
  }

  switch (intent) {
    case "daily_ops_summary":
      return {
        intent,
        title: "Resumen operativo del día",
        body: buildDailySummary(ctx.ops, ctx.analytics),
        actions: [
          ...(ctx.ops ? [{ label: "Ver tareas", copyText: "tareas pendientes" }] : []),
          { label: "Sala de espera", href: "/sala-espera" },
          ...(ctx.analytics ? [{ label: "Reportes caja", href: "/caja/reportes" }] : []),
        ],
      };

    case "revenue_today":
      return {
        intent,
        title: "Ingresos de hoy",
        body: `Total cobrado: ${formatCurrencyAr(ctx.analytics!.todayTotal)}\nCobros registrados: ${ctx.analytics!.todayChargeCount}\nCopagos: ${formatCurrencyAr(ctx.analytics!.copagoTotal)}\nCoseguros: ${formatCurrencyAr(ctx.analytics!.coseguroTotal)}`,
        actions: [
          { label: "Ver reportes", href: "/caja/reportes" },
          { label: "Copiar total", copyText: formatCurrencyAr(ctx.analytics!.todayTotal) },
        ],
      };

    case "revenue_month":
      return {
        intent,
        title: "Ingresos del mes",
        body: `Total del mes: ${formatCurrencyAr(ctx.analytics!.monthTotal)}\nCobros del mes: ${ctx.analytics!.monthChargeCount}`,
        actions: [{ label: "Reportes de caja", href: "/caja/reportes" }],
      };

    case "payment_breakdown":
      return {
        intent,
        title: "Desglose por método de pago (hoy)",
        body: formatBreakdownLines(ctx.analytics!.paymentBreakdown),
        actions: [{ label: "Caja", href: "/caja" }],
      };

    case "closure_status":
      return {
        intent,
        title: "Estado del cierre de caja",
        body: ctx.analytics!.closureClosedToday
          ? `La caja del ${ctx.analytics!.dateLabel} ya fue cerrada.`
          : `La caja del ${ctx.analytics!.dateLabel} aún está abierta.\nIngresos del día: ${formatCurrencyAr(ctx.analytics!.todayTotal)}`,
        actions: [{ label: "Ir a cierre", href: "/caja/cierre" }],
      };

    case "authorizations_list":
      return {
        intent,
        title: "Autorizaciones",
        body: formatAuthorizationsBody(ctx.analytics!),
        actions: [
          { label: "Documentos admin.", href: "/secretaria/documentos" },
          { label: "Caja", href: "/caja" },
        ],
      };

    case "copago_summary":
      return {
        intent,
        title: "Copagos y coseguros (hoy)",
        body: `Copagos autorizados: ${formatCurrencyAr(ctx.analytics!.copagoTotal)}\nCoseguros autorizados: ${formatCurrencyAr(ctx.analytics!.coseguroTotal)}\n\nPor tipo de atención:\n${formatBreakdownLines(ctx.analytics!.attentionBreakdown)}`,
        actions: [{ label: "Registrar cobro", href: "/caja" }],
      };

    case "waiting_queue": {
      const ops = ctx.ops!;
      return {
        intent,
        title: "Cola de espera",
        body: formatWaitingBody(ops),
        actions: [
          { label: "Gestionar sala", href: "/sala-espera" },
          { label: "Copiar lista", copyText: formatWaitingBody(ops) },
        ],
      };
    }

    case "overdue_appointments": {
      const ops = ctx.ops!;
      return {
        intent,
        title: "Turnos demorados",
        body:
          ops.overdueCount > 0
            ? `Hay ${ops.overdueCount} turno(s) sin atender después de la hora programada.\n\nRevisá la agenda del día o las tareas urgentes.`
            : "No hay turnos demorados en este momento.",
        actions: [
          { label: "Agenda del día", href: "/agenda?view=day" },
          ...(ops.highPriorityTasksCount > 0
            ? [{ label: "Ver tareas urgentes", copyText: "tareas pendientes" }]
            : []),
        ],
      };
    }

    case "pending_prescriptions": {
      const ops = ctx.ops!;
      return {
        intent,
        title: "Recetas borrador",
        body:
          ops.draftPrescriptionsCount > 0
            ? `${ops.draftPrescriptionsCount} receta(s) en borrador pendientes de emisión.\n\nRevisá el panel de operaciones o la ficha de cada paciente.`
            : "No hay recetas borrador pendientes.",
        actions: [{ label: "Dashboard", href: "/dashboard" }],
      };
    }

    case "pending_studies": {
      const ops = ctx.ops!;
      return {
        intent,
        title: "Estudios pendientes",
        body:
          ops.pendingStudiesCount > 0
            ? `${ops.pendingStudiesCount} estudio(s) adjunto(s) recientes por revisar.`
            : "No hay estudios pendientes de revisión.",
        actions: [{ label: "Dashboard", href: "/dashboard" }],
      };
    }

    case "tasks_list": {
      const ops = ctx.ops!;
      return {
        intent,
        title: "Tareas del día",
        body: formatTasksBody(ops),
        actions: ops.tasks.slice(0, 3).map((t) => ({ label: t.label, href: t.href })),
      };
    }

    case "notifications": {
      const ops = ctx.ops!;
      return {
        intent,
        title: "Notificaciones operativas",
        body: formatNotificationsBody(ops),
        actions: ops.notifications.slice(0, 3).map((n) => ({
          label: n.label,
          href: n.href,
        })),
      };
    }

    case "open_waiting_room":
      return {
        intent,
        title: "Sala de espera",
        body: "Te llevo a la sala de espera para llamar pacientes y actualizar estados.",
        actions: [{ label: "Abrir sala de espera", href: "/sala-espera" }],
      };

    case "open_agenda":
      return {
        intent,
        title: "Agenda del día",
        body: "Vista de turnos programados para hoy.",
        actions: [{ label: "Abrir agenda", href: "/agenda?view=day" }],
      };

    case "open_caja":
      return {
        intent,
        title: "Caja",
        body: ctx.canManageCash
          ? "Registro de cobros, cuenta corriente y cierre diario."
          : "No tenés permisos de caja en este consultorio.",
        actions: ctx.canManageCash ? [{ label: "Ir a caja", href: "/caja" }] : [],
      };

    case "cash_help":
      return {
        intent,
        title: "Ayuda de caja",
        body: ctx.canManageCash
          ? "Desde Caja podés:\n• Registrar cobros del día\n• Ver cuenta corriente por paciente\n• Cerrar caja al final del turno\n• Generar reportes por rango de fechas\n\nTodas las acciones quedan auditadas."
          : "Pedí acceso de caja al administrador del consultorio.",
        actions: ctx.canManageCash
          ? [
              { label: "Caja", href: "/caja" },
              { label: "Cuenta corriente", href: "/caja/cuenta-corriente" },
              { label: "Cierre diario", href: "/caja/cierre" },
            ]
          : [],
      };

    case "admin_help":
    default:
      return {
        intent: "admin_help",
        title: "Asistente operativo",
        body: `Preguntame, por ejemplo:\n${buildAdminOpsSuggestedPrompts(ctx)
          .map((p) => `• "${p}"`)
          .join("\n")}\n\n${ADMIN_OPS_DISCLAIMER}`,
        actions: [
          { label: "Dashboard", href: "/dashboard" },
          { label: "Sala de espera", href: "/sala-espera" },
          ...(ctx.canManageSettings ? [{ label: "Configuración", href: "/configuracion" }] : []),
        ],
      };
  }
}

export { ADMIN_OPS_DISCLAIMER };

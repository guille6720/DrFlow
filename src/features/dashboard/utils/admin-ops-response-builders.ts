import type {
  AdminOpsContext,
  AdminOpsIntentId,
  AdminOpsResponse,
  AdminOpsSnapshot,
} from "@/features/dashboard/utils/admin-ops-types";

import {
  type AdminAnalyticsSnapshot,
  formatBreakdownLines,
  formatCurrencyAr,
} from "@/lib/utils/admin-analytics-types";

const ADMIN_OPS_DISCLAIMER =
  "Asistencia operativa — verificá datos y confirmá acciones antes de ejecutarlas.";

export function formatWaitingBody(ops: AdminOpsSnapshot): string {
  if (ops.waiting.length === 0) return "No hay pacientes en cola de atención.";
  return ops.waiting
    .map((w, i) => `${i + 1}. ${w.name} — ${w.time} hs · ${w.status}`)
    .join("\n");
}

export function formatTasksBody(ops: AdminOpsSnapshot): string {
  if (ops.tasks.length === 0) return "No hay tareas pendientes registradas.";
  return ops.tasks
    .map((t, i) => {
      const badge = t.priority === "high" ? " [urgente]" : "";
      return `${i + 1}. ${t.label}${badge}\n   ${t.detail}`;
    })
    .join("\n\n");
}

export function formatNotificationsBody(ops: AdminOpsSnapshot): string {
  if (ops.notifications.length === 0) return "No hay notificaciones operativas.";
  return ops.notifications.map((n) => `• ${n.label} — ${n.patientName}`).join("\n");
}

export function formatAuthorizationsBody(analytics: AdminAnalyticsSnapshot): string {
  if (analytics.authorizationCount === 0) {
    return "No hay documentos de autorización registrados.";
  }
  const header = `${analytics.authorizationCount} autorización(es) en el consultorio.\n\nRecientes:`;
  const rows = analytics.recentAuthorizations
    .map((a) => `• ${a.patientName} — ${a.title}`)
    .join("\n");
  return rows ? `${header}\n${rows}` : header;
}

export function buildDailySummary(
  ops?: AdminOpsSnapshot,
  analytics?: AdminAnalyticsSnapshot
): string {
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

export function buildAdminOpsSuggestedPromptsForHelp(ctx: AdminOpsContext): string[] {
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

export function buildDailyOpsSummaryResponse(ctx: AdminOpsContext): AdminOpsResponse {
  return {
    intent: "daily_ops_summary",
    title: "Resumen operativo del día",
    body: buildDailySummary(ctx.ops, ctx.analytics),
    actions: [
      ...(ctx.ops ? [{ label: "Ver tareas", copyText: "tareas pendientes" }] : []),
      { label: "Sala de espera", href: "/sala-espera" },
      ...(ctx.analytics ? [{ label: "Reportes caja", href: "/caja/reportes" }] : []),
    ],
  };
}

export function buildRevenueTodayResponse(analytics: AdminAnalyticsSnapshot): AdminOpsResponse {
  return {
    intent: "revenue_today",
    title: "Ingresos de hoy",
    body: `Total cobrado: ${formatCurrencyAr(analytics.todayTotal)}\nCobros registrados: ${analytics.todayChargeCount}\nCopagos: ${formatCurrencyAr(analytics.copagoTotal)}\nCoseguros: ${formatCurrencyAr(analytics.coseguroTotal)}`,
    actions: [
      { label: "Ver reportes", href: "/caja/reportes" },
      { label: "Copiar total", copyText: formatCurrencyAr(analytics.todayTotal) },
    ],
  };
}

export function buildRevenueMonthResponse(analytics: AdminAnalyticsSnapshot): AdminOpsResponse {
  return {
    intent: "revenue_month",
    title: "Ingresos del mes",
    body: `Total del mes: ${formatCurrencyAr(analytics.monthTotal)}\nCobros del mes: ${analytics.monthChargeCount}`,
    actions: [{ label: "Reportes de caja", href: "/caja/reportes" }],
  };
}

export function buildPaymentBreakdownResponse(analytics: AdminAnalyticsSnapshot): AdminOpsResponse {
  return {
    intent: "payment_breakdown",
    title: "Desglose por método de pago (hoy)",
    body: formatBreakdownLines(analytics.paymentBreakdown),
    actions: [{ label: "Caja", href: "/caja" }],
  };
}

export function buildClosureStatusResponse(analytics: AdminAnalyticsSnapshot): AdminOpsResponse {
  return {
    intent: "closure_status",
    title: "Estado del cierre de caja",
    body: analytics.closureClosedToday
      ? `La caja del ${analytics.dateLabel} ya fue cerrada.`
      : `La caja del ${analytics.dateLabel} aún está abierta.\nIngresos del día: ${formatCurrencyAr(analytics.todayTotal)}`,
    actions: [{ label: "Ir a cierre", href: "/caja/cierre" }],
  };
}

export function buildAuthorizationsResponse(analytics: AdminAnalyticsSnapshot): AdminOpsResponse {
  return {
    intent: "authorizations_list",
    title: "Autorizaciones",
    body: formatAuthorizationsBody(analytics),
    actions: [
      { label: "Documentos admin.", href: "/secretaria/documentos" },
      { label: "Caja", href: "/caja" },
    ],
  };
}

export function buildCopagoSummaryResponse(analytics: AdminAnalyticsSnapshot): AdminOpsResponse {
  return {
    intent: "copago_summary",
    title: "Copagos y coseguros (hoy)",
    body: `Copagos autorizados: ${formatCurrencyAr(analytics.copagoTotal)}\nCoseguros autorizados: ${formatCurrencyAr(analytics.coseguroTotal)}\n\nPor tipo de atención:\n${formatBreakdownLines(analytics.attentionBreakdown)}`,
    actions: [{ label: "Registrar cobro", href: "/caja" }],
  };
}

export function buildWaitingQueueResponse(ops: AdminOpsSnapshot): AdminOpsResponse {
  return {
    intent: "waiting_queue",
    title: "Cola de espera",
    body: formatWaitingBody(ops),
    actions: [
      { label: "Gestionar sala", href: "/sala-espera" },
      { label: "Copiar lista", copyText: formatWaitingBody(ops) },
    ],
  };
}

export function buildOverdueAppointmentsResponse(ops: AdminOpsSnapshot): AdminOpsResponse {
  return {
    intent: "overdue_appointments",
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

export function buildPendingPrescriptionsResponse(ops: AdminOpsSnapshot): AdminOpsResponse {
  return {
    intent: "pending_prescriptions",
    title: "Recetas borrador",
    body:
      ops.draftPrescriptionsCount > 0
        ? `${ops.draftPrescriptionsCount} receta(s) en borrador pendientes de emisión.\n\nRevisá el panel de operaciones o la ficha de cada paciente.`
        : "No hay recetas borrador pendientes.",
    actions: [{ label: "Dashboard", href: "/dashboard" }],
  };
}

export function buildPendingStudiesResponse(ops: AdminOpsSnapshot): AdminOpsResponse {
  return {
    intent: "pending_studies",
    title: "Estudios pendientes",
    body:
      ops.pendingStudiesCount > 0
        ? `${ops.pendingStudiesCount} estudio(s) adjunto(s) recientes por revisar.`
        : "No hay estudios pendientes de revisión.",
    actions: [{ label: "Dashboard", href: "/dashboard" }],
  };
}

export function buildTasksListResponse(ops: AdminOpsSnapshot): AdminOpsResponse {
  return {
    intent: "tasks_list",
    title: "Tareas del día",
    body: formatTasksBody(ops),
    actions: ops.tasks.slice(0, 3).map((t) => ({ label: t.label, href: t.href })),
  };
}

export function buildNotificationsResponse(ops: AdminOpsSnapshot): AdminOpsResponse {
  return {
    intent: "notifications",
    title: "Notificaciones operativas",
    body: formatNotificationsBody(ops),
    actions: ops.notifications.slice(0, 3).map((n) => ({
      label: n.label,
      href: n.href,
    })),
  };
}

export function buildOpenWaitingRoomResponse(): AdminOpsResponse {
  return {
    intent: "open_waiting_room",
    title: "Sala de espera",
    body: "Te llevo a la sala de espera para llamar pacientes y actualizar estados.",
    actions: [{ label: "Abrir sala de espera", href: "/sala-espera" }],
  };
}

export function buildOpenAgendaResponse(): AdminOpsResponse {
  return {
    intent: "open_agenda",
    title: "Agenda del día",
    body: "Vista de turnos programados para hoy.",
    actions: [{ label: "Abrir agenda", href: "/agenda?view=day" }],
  };
}

export function buildOpenCajaResponse(ctx: AdminOpsContext): AdminOpsResponse {
  return {
    intent: "open_caja",
    title: "Caja",
    body: ctx.canManageCash
      ? "Registro de cobros, cuenta corriente y cierre diario."
      : "No tenés permisos de caja en este consultorio.",
    actions: ctx.canManageCash ? [{ label: "Ir a caja", href: "/caja" }] : [],
  };
}

export function buildCashHelpResponse(ctx: AdminOpsContext): AdminOpsResponse {
  return {
    intent: "cash_help",
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
}

export function buildAdminHelpResponse(ctx: AdminOpsContext): AdminOpsResponse {
  return {
    intent: "admin_help",
    title: "Asistente operativo",
    body: `Preguntame, por ejemplo:\n${buildAdminOpsSuggestedPromptsForHelp(ctx)
      .map((p) => `• "${p}"`)
      .join("\n")}\n\n${ADMIN_OPS_DISCLAIMER}`,
    actions: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Sala de espera", href: "/sala-espera" },
      ...(ctx.canManageSettings ? [{ label: "Configuración", href: "/configuracion" }] : []),
    ],
  };
}

export const ANALYTICS_INTENTS: AdminOpsIntentId[] = [
  "revenue_today",
  "revenue_month",
  "payment_breakdown",
  "closure_status",
  "authorizations_list",
  "copago_summary",
];

export const OPS_INTENTS: AdminOpsIntentId[] = [
  "waiting_queue",
  "overdue_appointments",
  "pending_prescriptions",
  "pending_studies",
  "tasks_list",
  "notifications",
];

export function buildAdminOpsResponseForIntent(
  intent: AdminOpsIntentId,
  ctx: AdminOpsContext
): AdminOpsResponse {
  switch (intent) {
    case "daily_ops_summary":
      return buildDailyOpsSummaryResponse(ctx);
    case "revenue_today":
      return buildRevenueTodayResponse(ctx.analytics!);
    case "revenue_month":
      return buildRevenueMonthResponse(ctx.analytics!);
    case "payment_breakdown":
      return buildPaymentBreakdownResponse(ctx.analytics!);
    case "closure_status":
      return buildClosureStatusResponse(ctx.analytics!);
    case "authorizations_list":
      return buildAuthorizationsResponse(ctx.analytics!);
    case "copago_summary":
      return buildCopagoSummaryResponse(ctx.analytics!);
    case "waiting_queue":
      return buildWaitingQueueResponse(ctx.ops!);
    case "overdue_appointments":
      return buildOverdueAppointmentsResponse(ctx.ops!);
    case "pending_prescriptions":
      return buildPendingPrescriptionsResponse(ctx.ops!);
    case "pending_studies":
      return buildPendingStudiesResponse(ctx.ops!);
    case "tasks_list":
      return buildTasksListResponse(ctx.ops!);
    case "notifications":
      return buildNotificationsResponse(ctx.ops!);
    case "open_waiting_room":
      return buildOpenWaitingRoomResponse();
    case "open_agenda":
      return buildOpenAgendaResponse();
    case "open_caja":
      return buildOpenCajaResponse(ctx);
    case "cash_help":
      return buildCashHelpResponse(ctx);
    case "admin_help":
    default:
      return buildAdminHelpResponse(ctx);
  }
}

export { ADMIN_OPS_DISCLAIMER };

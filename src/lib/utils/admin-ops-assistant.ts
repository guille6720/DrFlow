import type { AdminOpsContext, AdminOpsSnapshot } from "@/lib/utils/admin-ops-types";

export type AdminOpsIntentId =
  | "daily_ops_summary"
  | "waiting_queue"
  | "overdue_appointments"
  | "pending_prescriptions"
  | "pending_studies"
  | "tasks_list"
  | "notifications"
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
    patterns: [/tareas?\s+pend/i, /pendientes?\s+del\s+d[ií]a/i, /qu[eé]\s+hacer/i, /to-?do/i],
  },
  {
    id: "notifications",
    patterns: [/notificaciones?/i, /alertas?\s+operativ/i, /ausentes?/i, /cancelad/i],
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
    patterns: [/abrir\s+caja/i, /ir\s+a\s+caja/i, /cobros?\s+de\s+hoy/i],
  },
  {
    id: "cash_help",
    patterns: [/cerrar\s+caja/i, /cuenta\s+corriente/i, /cobro/i, /factura/i, /ledger/i],
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

function buildDailySummary(ops: AdminOpsSnapshot): string {
  const lines = [
    `Cola de espera: ${ops.waitingCount} paciente(s)`,
    `Turnos demorados: ${ops.overdueCount}`,
    `Recetas borrador: ${ops.draftPrescriptionsCount}`,
    `Estudios por revisar: ${ops.pendingStudiesCount}`,
    `Tareas pendientes: ${ops.tasksCount} (${ops.highPriorityTasksCount} urgentes)`,
    `Notificaciones: ${ops.notificationsCount}`,
  ];
  if (ops.criticalPatientsCount > 0) {
    lines.push(`Pacientes con alerta crítica: ${ops.criticalPatientsCount}`);
  }
  return lines.join("\n");
}

/** Context-aware suggested prompts for empty admin ops copilot. */
export function buildAdminOpsSuggestedPrompts(ctx: AdminOpsContext): string[] {
  if (!ctx.ops) {
    return ["Resumen del día", "Ir a sala de espera", "Ayuda de caja"];
  }
  return [
    "Resumen del día",
    "¿Quién está en espera?",
    "Turnos demorados",
    "Tareas pendientes",
    "Recetas borrador",
  ];
}

/** Build admin/ops response for matched intent (Phase G — rule-based). */
export function buildAdminOpsResponse(intent: AdminOpsIntentId, ctx: AdminOpsContext): AdminOpsResponse {
  const opsMissing = requireOps(ctx);
  const needsOps =
    intent !== "admin_help" &&
    intent !== "open_waiting_room" &&
    intent !== "open_agenda" &&
    intent !== "open_caja" &&
    intent !== "cash_help";

  if (needsOps && opsMissing) return opsMissing;

  const ops = ctx.ops!;

  switch (intent) {
    case "daily_ops_summary":
      return {
        intent,
        title: "Resumen operativo del día",
        body: buildDailySummary(ops),
        actions: [
          { label: "Ver tareas", copyText: "tareas pendientes" },
          { label: "Sala de espera", href: "/sala-espera" },
        ],
      };

    case "waiting_queue":
      return {
        intent,
        title: "Cola de espera",
        body: formatWaitingBody(ops),
        actions: [
          { label: "Gestionar sala", href: "/sala-espera" },
          { label: "Copiar lista", copyText: formatWaitingBody(ops) },
        ],
      };

    case "overdue_appointments":
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

    case "pending_prescriptions":
      return {
        intent,
        title: "Recetas borrador",
        body:
          ops.draftPrescriptionsCount > 0
            ? `${ops.draftPrescriptionsCount} receta(s) en borrador pendientes de emisión.\n\nRevisá el panel de operaciones o la ficha de cada paciente.`
            : "No hay recetas borrador pendientes.",
        actions: [{ label: "Dashboard", href: "/dashboard" }],
      };

    case "pending_studies":
      return {
        intent,
        title: "Estudios pendientes",
        body:
          ops.pendingStudiesCount > 0
            ? `${ops.pendingStudiesCount} estudio(s) adjunto(s) recientes por revisar.`
            : "No hay estudios pendientes de revisión.",
        actions: [{ label: "Dashboard", href: "/dashboard" }],
      };

    case "tasks_list":
      return {
        intent,
        title: "Tareas del día",
        body: formatTasksBody(ops),
        actions: ops.tasks.slice(0, 3).map((t) => ({ label: t.label, href: t.href })),
      };

    case "notifications":
      return {
        intent,
        title: "Notificaciones operativas",
        body: formatNotificationsBody(ops),
        actions: ops.notifications.slice(0, 3).map((n) => ({
          label: n.label,
          href: n.href,
        })),
      };

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

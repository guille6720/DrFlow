import type { ClientEntitlementsSnapshot } from "@/core/entitlements/types";

import { formatClinicDateTime } from "@/shared/utils/clinic-timezone";

import type { AdminAnalyticsSnapshot } from "@/lib/utils/admin-analytics-types";

export type AdminOpsPageHint =
  | "dashboard"
  | "caja"
  | "caja_reportes"
  | "waiting_room"
  | "agenda"
  | "settings"
  | "documentos";

export type AdminOpsWaitingRow = {
  name: string;
  status: string;
  time: string;
};

export type AdminOpsTaskRow = {
  label: string;
  detail: string;
  href: string;
  priority: "high" | "normal";
};

export type AdminOpsNotificationRow = {
  label: string;
  patientName: string;
  href: string;
};

/** Non-clinical ops snapshot for rule-based admin/ops agents (Phase G). */
export type AdminOpsSnapshot = {
  waitingCount: number;
  overdueCount: number;
  draftPrescriptionsCount: number;
  pendingStudiesCount: number;
  tasksCount: number;
  highPriorityTasksCount: number;
  notificationsCount: number;
  criticalPatientsCount: number;
  waiting: AdminOpsWaitingRow[];
  tasks: AdminOpsTaskRow[];
  notifications: AdminOpsNotificationRow[];
};

export type AdminOpsContext = {
  page?: AdminOpsPageHint;
  ops?: AdminOpsSnapshot;
  analytics?: AdminAnalyticsSnapshot;
  canManageCash?: boolean;
  canManageWaitingRoom?: boolean;
  canManageSettings?: boolean;
  canViewReports?: boolean;
  entitlementsSnapshot?: ClientEntitlementsSnapshot | null;
};

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

export function buildAdminOpsSnapshotFromDashboard(
  ops:
    | import("@/features/dashboard/utils/clinical-operations-dashboard-types").ClinicalOperationsDashboardPayload
    | import("@/features/dashboard/utils/clinical-operations-dashboard-types").ClinicalOperationsDashboardCorePayload
): AdminOpsSnapshot {
  const waiting = (ops.waiting ?? []).slice(0, 8).map((row) => {
    const name = row.patients
      ? `${row.patients.last_name}, ${row.patients.first_name}`
      : "Paciente";
    const status =
      row.waiting_room_status === "called"
        ? "Llamado"
        : row.waiting_room_status === "in_consultation"
          ? "En consultorio"
          : "En espera";
    return {
      name,
      status,
      time: formatClinicDateTime(row.start_at, "HH:mm"),
    };
  });

  const taskList = "tasks" in ops && ops.tasks ? ops.tasks : [];
  const tasks = taskList.slice(0, 10).map((t) => ({
    label: t.label,
    detail: t.detail,
    href: t.href,
    priority: t.priority,
  }));

  const notifications = (ops.notifications ?? []).slice(0, 6).map((n) => ({
    label: n.label,
    patientName: n.patientName,
    href: n.href,
  }));

  return {
    waitingCount: (ops.waiting ?? []).length,
    overdueCount: (ops.overdue ?? []).length,
    draftPrescriptionsCount: ("draftPrescriptions" in ops ? ops.draftPrescriptions?.length : 0) ?? 0,
    pendingStudiesCount: ("pendingStudies" in ops ? ops.pendingStudies?.length : 0) ?? 0,
    tasksCount: ("tasks" in ops ? ops.tasks?.length : 0) ?? 0,
    highPriorityTasksCount: ("tasks" in ops ? (ops.tasks ?? []).filter((t) => t.priority === "high").length : 0),
    notificationsCount: (ops.notifications ?? []).length,
    criticalPatientsCount: (ops.criticalPatients ?? []).length,
    waiting,
    tasks,
    notifications,
  };
}

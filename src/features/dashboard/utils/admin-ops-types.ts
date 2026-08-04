import type { ClinicalOperationsDashboardPayload } from "@/features/dashboard/utils/clinical-operations-dashboard-types";
import type { AdminAnalyticsSnapshot } from "@/lib/utils/admin-analytics-types";
import { formatClinicDateTime } from "@/shared/utils/clinic-timezone";

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
};

export function buildAdminOpsSnapshotFromDashboard(
  ops: ClinicalOperationsDashboardPayload
): AdminOpsSnapshot {
  const waiting = ops.waiting.slice(0, 8).map((row) => {
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

  const tasks = ops.tasks.slice(0, 10).map((t) => ({
    label: t.label,
    detail: t.detail,
    href: t.href,
    priority: t.priority,
  }));

  const notifications = ops.notifications.slice(0, 6).map((n) => ({
    label: n.label,
    patientName: n.patientName,
    href: n.href,
  }));

  return {
    waitingCount: ops.waiting.length,
    overdueCount: ops.overdue.length,
    draftPrescriptionsCount: ops.draftPrescriptions.length,
    pendingStudiesCount: ops.pendingStudies.length,
    tasksCount: ops.tasks.length,
    highPriorityTasksCount: ops.tasks.filter((t) => t.priority === "high").length,
    notificationsCount: ops.notifications.length,
    criticalPatientsCount: ops.criticalPatients.length,
    waiting,
    tasks,
    notifications,
  };
}

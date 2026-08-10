import type { ClinicalOperationsDashboardPayload } from "@/features/dashboard/utils/clinical-operations-dashboard-types";
import type { ClinicalOpsActivityMetrics } from "@/features/dashboard/utils/clinical-operations-types";

const EMPTY_ACTIVITY: ClinicalOpsActivityMetrics = {
  waitingCount: 0,
  attendedCount: 0,
  averageWaitingMinutes: null,
  nextAppointment: null,
  delayedCount: 0,
};

/** Guards dashboard render when optional sections are missing from cached payloads. */
export function normalizeClinicalOpsPayload(
  ops: ClinicalOperationsDashboardPayload
): ClinicalOperationsDashboardPayload {
  return {
    ...ops,
    waiting: ops.waiting ?? [],
    upcoming: ops.upcoming ?? [],
    overdue: ops.overdue ?? [],
    draftPrescriptions: ops.draftPrescriptions ?? [],
    pendingStudies: ops.pendingStudies ?? [],
    criticalPatients: ops.criticalPatients ?? [],
    notifications: ops.notifications ?? [],
    todayAppointments: ops.todayAppointments ?? [],
    tasks: ops.tasks ?? [],
    activity: ops.activity ?? EMPTY_ACTIVITY,
    enrichedWaiting: ops.enrichedWaiting ?? [],
    actionableAlerts: ops.actionableAlerts ?? [],
    pendingOrders: ops.pendingOrders ?? [],
    recentLabs: ops.recentLabs ?? [],
    urgentPatients: ops.urgentPatients ?? [],
  };
}

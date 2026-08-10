import type {
  ClinicalOperationsDashboardCorePayload,
  ClinicalOperationsDashboardPayload,
  ClinicalOperationsDashboardSecondaryPayload,
} from "@/features/dashboard/utils/clinical-operations-dashboard-types";
import type { ClinicalOpsActivityMetrics } from "@/features/dashboard/utils/clinical-operations-types";

export const EMPTY_CLINICAL_OPS_ACTIVITY: ClinicalOpsActivityMetrics = {
  waitingCount: 0,
  attendedCount: 0,
  averageWaitingMinutes: null,
  nextAppointment: null,
  delayedCount: 0,
};

/** Guards dashboard render when optional sections are missing from cached payloads. */
export function normalizeClinicalOpsCorePayload(
  ops: ClinicalOperationsDashboardCorePayload
): ClinicalOperationsDashboardCorePayload {
  return {
    ...ops,
    waiting: ops.waiting ?? [],
    upcoming: ops.upcoming ?? [],
    overdue: ops.overdue ?? [],
    criticalPatients: ops.criticalPatients ?? [],
    notifications: ops.notifications ?? [],
    todayAppointments: ops.todayAppointments ?? [],
    activity: ops.activity ?? EMPTY_CLINICAL_OPS_ACTIVITY,
    enrichedWaiting: ops.enrichedWaiting ?? [],
    actionableAlerts: ops.actionableAlerts ?? [],
    urgentPatients: ops.urgentPatients ?? [],
  };
}

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
    activity: ops.activity ?? EMPTY_CLINICAL_OPS_ACTIVITY,
    enrichedWaiting: ops.enrichedWaiting ?? [],
    actionableAlerts: ops.actionableAlerts ?? [],
    pendingOrders: ops.pendingOrders ?? [],
    recentLabs: ops.recentLabs ?? [],
    urgentPatients: ops.urgentPatients ?? [],
  };
}

export function emptyClinicalOpsCorePayload(): ClinicalOperationsDashboardCorePayload {
  return normalizeClinicalOpsCorePayload({
    waiting: [],
    upcoming: [],
    overdue: [],
    criticalPatients: [],
    notifications: [],
    todayAppointments: [],
    activity: EMPTY_CLINICAL_OPS_ACTIVITY,
    enrichedWaiting: [],
    actionableAlerts: [],
    urgentPatients: [],
  });
}

export function normalizeClinicalOpsSecondaryPayload(
  ops: ClinicalOperationsDashboardSecondaryPayload
): ClinicalOperationsDashboardSecondaryPayload {
  return {
    draftPrescriptions: ops.draftPrescriptions ?? [],
    pendingStudies: ops.pendingStudies ?? [],
    tasks: ops.tasks ?? [],
    pendingOrders: ops.pendingOrders ?? [],
    recentLabs: ops.recentLabs ?? [],
  };
}

export function emptyClinicalOpsSecondaryPayload(): ClinicalOperationsDashboardSecondaryPayload {
  return normalizeClinicalOpsSecondaryPayload({
    draftPrescriptions: [],
    pendingStudies: [],
    tasks: [],
    pendingOrders: [],
    recentLabs: [],
  });
}

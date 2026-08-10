import type { LiveAppointment } from "@/features/dashboard/utils/clinical-operations-types";
import type {
  ClinicalOperationsPayload,
  ClinicalOpsActionableAlert,
  ClinicalOpsActivityMetrics,
  ClinicalOpsEnrichedWaitingRow,
  ClinicalOpsLabResult,
  ClinicalOpsPendingOrder,
} from "@/features/dashboard/utils/clinical-operations-types";

export type ClinicalOpsTask = {
  id: string;
  kind:
    | "overdue_appointment"
    | "confirm_appointment"
    | "draft_prescription"
    | "pending_study"
    | "queued_reminder";
  label: string;
  detail: string;
  at: string;
  href: string;
  priority: "high" | "normal";
};

export type ClinicalOperationsDashboardPayload = ClinicalOperationsPayload & {
  todayAppointments: LiveAppointment[];
  tasks: ClinicalOpsTask[];
  activity: ClinicalOpsActivityMetrics;
  enrichedWaiting: ClinicalOpsEnrichedWaitingRow[];
  actionableAlerts: ClinicalOpsActionableAlert[];
  pendingOrders: ClinicalOpsPendingOrder[];
  recentLabs: ClinicalOpsLabResult[];
  urgentPatients: ClinicalOpsEnrichedWaitingRow[];
};

/** Above-the-fold dashboard slice — streams first. */
export type ClinicalOperationsDashboardCorePayload = Pick<
  ClinicalOperationsDashboardPayload,
  | "waiting"
  | "upcoming"
  | "overdue"
  | "criticalPatients"
  | "notifications"
  | "todayAppointments"
  | "activity"
  | "enrichedWaiting"
  | "actionableAlerts"
  | "urgentPatients"
>;

/** Below-the-fold widgets — deferred via Suspense. */
export type ClinicalOperationsDashboardSecondaryPayload = Pick<
  ClinicalOperationsDashboardPayload,
  "draftPrescriptions" | "pendingStudies" | "tasks" | "pendingOrders" | "recentLabs"
>;

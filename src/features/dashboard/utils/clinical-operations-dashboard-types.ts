import type { LiveAppointment } from "@/features/dashboard/utils/clinical-operations-types";
import type {
  ClinicalOpsActionableAlert,
  ClinicalOpsActivityMetrics,
  ClinicalOpsEnrichedWaitingRow,
  ClinicalOpsLabResult,
  ClinicalOpsPendingOrder,
  ClinicalOperationsPayload,
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

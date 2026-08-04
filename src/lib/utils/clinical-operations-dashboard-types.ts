import type { LiveAppointment } from "@/components/dashboard/consultorio-live-panel";
import type { ClinicalOperationsPayload } from "@/lib/utils/clinical-operations-types";

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
};

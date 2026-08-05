import { ClinicalOpsActivityStrip } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-activity-strip";
import {
  CriticalAlertsSection,
  WaitingQueueSection,
} from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-queue-sections";
import {
  NotificationsSection,
  TodayScheduleSection,
} from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-tasks-sections";
import { ClinicalOpsTodayTasksSection } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-today-tasks-section";
import {
  LabResultsSection,
  PrescriptionsAndOrdersSections,
} from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-worklist-sections";
import type { ClinicalOperationsDashboardPayload } from "@/features/dashboard/utils/clinical-operations-dashboard-types";

type Props = {
  ops: ClinicalOperationsDashboardPayload;
  canManageAppointments: boolean;
};

export function ClinicalOpsMainSections({ ops, canManageAppointments }: Props) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ClinicalOpsActivityStrip activity={ops.activity} />
      <WaitingQueueSection rows={ops.enrichedWaiting} />
      <CriticalAlertsSection alerts={ops.actionableAlerts} />
      <PrescriptionsAndOrdersSections
        draftPrescriptions={ops.draftPrescriptions}
        pendingOrders={ops.pendingOrders}
      />
      <LabResultsSection items={ops.recentLabs} />
      <ClinicalOpsTodayTasksSection tasks={ops.tasks} />
      <TodayScheduleSection
        appointments={ops.todayAppointments}
        canManageAppointments={canManageAppointments}
      />
      <NotificationsSection notifications={ops.notifications} />
    </div>
  );
}

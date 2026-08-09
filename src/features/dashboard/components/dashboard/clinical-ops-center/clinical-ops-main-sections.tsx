import { ClinicalOpsActivityStrip } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-activity-strip";
import { ClinicalOpsHashScroll } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-hash-scroll";
import {
  CriticalAlertsSection,
  UrgentPatientsSection,
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
      <ClinicalOpsHashScroll />
      <ClinicalOpsActivityStrip activity={ops.activity} />
      <TodayScheduleSection
        appointments={ops.todayAppointments}
        canManageAppointments={canManageAppointments}
      />
      <WaitingQueueSection rows={ops.enrichedWaiting} />
      <UrgentPatientsSection rows={ops.urgentPatients} />
      <CriticalAlertsSection alerts={ops.actionableAlerts} />
      <PrescriptionsAndOrdersSections
        draftPrescriptions={ops.draftPrescriptions}
        pendingOrders={ops.pendingOrders}
      />
      <LabResultsSection items={ops.recentLabs} />
      <ClinicalOpsTodayTasksSection tasks={ops.tasks} />
      <NotificationsSection notifications={ops.notifications} />
    </div>
  );
}

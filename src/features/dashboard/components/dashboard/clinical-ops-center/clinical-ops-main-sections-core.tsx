
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
import type { ClinicalOperationsDashboardCorePayload } from "@/features/dashboard/utils/clinical-operations-dashboard-types";

type Props = {
  ops: ClinicalOperationsDashboardCorePayload;
  canManageAppointments: boolean;
  secondary?: React.ReactNode;
};

export function ClinicalOpsMainSectionsCore({ ops, canManageAppointments, secondary }: Props) {
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
      {secondary}
      <NotificationsSection notifications={ops.notifications} />
    </div>
  );
}

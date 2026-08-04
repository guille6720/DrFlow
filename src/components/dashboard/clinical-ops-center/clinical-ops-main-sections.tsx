"use client";

import { ActivityStrip } from "@/components/dashboard/clinical-ops-center/clinical-ops-activity-strip";
import {
  CriticalAlertsSection,
  WaitingQueueSection,
} from "@/components/dashboard/clinical-ops-center/clinical-ops-queue-sections";
import {
  NotificationsSection,
  TodayScheduleSection,
  TodayTasksSection,
} from "@/components/dashboard/clinical-ops-center/clinical-ops-tasks-sections";
import { useCompletedOpsTasks } from "@/lib/hooks/use-completed-ops-tasks";
import {
  LabResultsSection,
  PrescriptionsAndOrdersSections,
} from "@/components/dashboard/clinical-ops-center/clinical-ops-worklist-sections";
import type { ClinicalOperationsDashboardPayload } from "@/lib/utils/clinical-operations-dashboard-types";

type Props = {
  ops: ClinicalOperationsDashboardPayload;
  canManageAppointments: boolean;
};

export function ClinicalOpsMainSections({ ops, canManageAppointments }: Props) {
  const { openTasks, markDone } = useCompletedOpsTasks(ops.tasks);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ActivityStrip activity={ops.activity} />
      <WaitingQueueSection rows={ops.enrichedWaiting} />
      <CriticalAlertsSection alerts={ops.actionableAlerts} />
      <PrescriptionsAndOrdersSections
        draftPrescriptions={ops.draftPrescriptions}
        pendingOrders={ops.pendingOrders}
      />
      <LabResultsSection items={ops.recentLabs} />
      <TodayTasksSection tasks={openTasks} onComplete={markDone} />
      <TodayScheduleSection
        appointments={ops.todayAppointments}
        canManageAppointments={canManageAppointments}
      />
      <NotificationsSection notifications={ops.notifications} />
    </div>
  );
}

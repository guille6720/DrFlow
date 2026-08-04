"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ClinicalOperationsDashboardPayload } from "@/lib/utils/clinical-operations-dashboard-types";
import {
  ClinicalOpsDraftPrescriptionsCard,
  ClinicalOpsNotificationsCard,
  ClinicalOpsPendingStudiesCard,
} from "@/components/dashboard/clinical-ops-action-cards";
import {
  ClinicalOpsTodayAppointmentsCard,
  ClinicalOpsWaitingCard,
} from "@/components/dashboard/clinical-ops-queue-cards";
import {
  ClinicalOpsCriticalAlertsCard,
  ClinicalOpsTasksCard,
} from "@/components/dashboard/clinical-ops-tasks-cards";
import { AdminOpsDashboardBridge } from "@/components/admin-ops/admin-ops-dashboard-bridge";

type Props = {
  ops: ClinicalOperationsDashboardPayload;
  canManageAppointments: boolean;
  canManageCash?: boolean;
  canManageWaitingRoom?: boolean;
  canManageSettings?: boolean;
};

/** Operational dashboard — physicians and reception; no decorative widgets. */
export function ClinicalOperationsDashboard({
  ops,
  canManageAppointments,
  canManageCash,
  canManageWaitingRoom,
  canManageSettings,
}: Props) {
  return (
    <section aria-label="Operaciones clínicas" className="space-y-4">
      <AdminOpsDashboardBridge
        ops={ops}
        canManageCash={canManageCash}
        canManageWaitingRoom={canManageWaitingRoom}
        canManageSettings={canManageSettings}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Cola de atención, alertas y pendientes del día
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/agenda?view=day">
            <Button variant="outline" size="sm">
              <CalendarDays className="h-4 w-4" />
              Agenda del día
            </Button>
          </Link>
          <Link href="/sala-espera">
            <Button variant="outline" size="sm">
              Sala de espera
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ClinicalOpsWaitingCard waiting={ops.waiting} />
        <ClinicalOpsTodayAppointmentsCard
          todayAppointments={ops.todayAppointments}
          canManageAppointments={canManageAppointments}
        />
        <ClinicalOpsCriticalAlertsCard
          criticalPatients={ops.criticalPatients}
          overdueCount={ops.overdue.length}
        />
        <ClinicalOpsDraftPrescriptionsCard draftPrescriptions={ops.draftPrescriptions} />
        <ClinicalOpsPendingStudiesCard pendingStudies={ops.pendingStudies} />
        <ClinicalOpsTasksCard tasks={ops.tasks} />
      </div>

      <ClinicalOpsNotificationsCard notifications={ops.notifications} />
    </section>
  );
}

"use client";

import { AdminOpsDashboardBridge } from "@/components/admin-ops/admin-ops-dashboard-bridge";
import { ClinicalOpsAiRail } from "@/components/dashboard/clinical-ops-center/clinical-ops-ai-rail";
import { ClinicalOpsLeftRail } from "@/components/dashboard/clinical-ops-center/clinical-ops-left-rail";
import { ClinicalOpsMainSections } from "@/components/dashboard/clinical-ops-center/clinical-ops-main-sections";
import { ClinicalOpsQuickActions } from "@/components/dashboard/clinical-ops-center/clinical-ops-quick-actions";
import { ClinicalOpsRealtime } from "@/components/dashboard/clinical-ops-center/clinical-ops-realtime";
import { ClinicalOpsTopBar } from "@/components/dashboard/clinical-ops-center/clinical-ops-top-bar";
import type { ClinicalOperationsDashboardPayload } from "@/lib/utils/clinical-operations-dashboard-types";

type Props = {
  clinicId: string;
  clinicName: string;
  professionalName?: string | null;
  ops: ClinicalOperationsDashboardPayload;
  canManageAppointments: boolean;
  canManageCash?: boolean;
  canManageWaitingRoom?: boolean;
  canManageSettings?: boolean;
};

/** Clinical Operations Center — decision-focused workspace for physicians and staff. */
export function ClinicalOpsCenter({
  clinicId,
  clinicName,
  professionalName,
  ops,
  canManageAppointments,
  canManageCash,
  canManageWaitingRoom,
  canManageSettings,
}: Props) {
  return (
    <section aria-label="Centro de operaciones clínicas" className="clinical-ops-center space-y-4">
      <ClinicalOpsRealtime clinicId={clinicId} />
      <AdminOpsDashboardBridge
        ops={ops}
        canManageCash={canManageCash}
        canManageWaitingRoom={canManageWaitingRoom}
        canManageSettings={canManageSettings}
      />

      <ClinicalOpsTopBar
        clinicName={clinicName}
        professionalName={professionalName}
        notificationCount={ops.notifications.length}
      />

      <div className="clinical-ops-grid grid gap-4 lg:grid-cols-[minmax(11rem,13rem)_minmax(0,1fr)] xl:grid-cols-[minmax(11rem,13rem)_minmax(0,1fr)_minmax(14rem,17rem)]">
        <div className="hidden lg:block">
          <ClinicalOpsLeftRail ops={ops} />
        </div>

        <ClinicalOpsMainSections ops={ops} canManageAppointments={canManageAppointments} />

        <div className="hidden xl:block">
          <ClinicalOpsAiRail ops={ops} />
        </div>
      </div>

      <ClinicalOpsQuickActions />
    </section>
  );
}

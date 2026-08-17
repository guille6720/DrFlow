import type { ReactNode } from "react";

import { ClinicalOpsLeftRail } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-left-rail";
import { ClinicalOpsMainSectionsCore } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-main-sections-core";
import { ClinicalOpsQuickActions } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-quick-actions";
import { ClinicalOpsRealtime } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-realtime";
import { ClinicalOpsTopBar } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-top-bar";
import type { ClinicalOperationsDashboardCorePayload } from "@/features/dashboard/utils/clinical-operations-dashboard-types";
import { AdminOpsDashboardBridge } from "@/features/ia/components/admin-ops/admin-ops-dashboard-bridge";

type Props = {
  clinicId: string;
  clinicName: string;
  professionalName?: string | null;
  core: ClinicalOperationsDashboardCorePayload;
  secondary?: ReactNode;
  canManageAppointments: boolean;
  canManageCash?: boolean;
  canManageWaitingRoom?: boolean;
  canManageSettings?: boolean;
};

/** Clinical Operations Center — core streams first; secondary widgets defer via Suspense. */
export function ClinicalOpsCenter({
  clinicId,
  clinicName,
  professionalName,
  core,
  secondary,
  canManageAppointments,
  canManageCash,
  canManageWaitingRoom,
  canManageSettings,
}: Props) {
  return (
    <section aria-label="Centro de operaciones clínicas" className="clinical-ops-center space-y-4">
      <ClinicalOpsRealtime clinicId={clinicId} />
      <AdminOpsDashboardBridge
        ops={core}
        canManageCash={canManageCash}
        canManageWaitingRoom={canManageWaitingRoom}
        canManageSettings={canManageSettings}
      />

      <ClinicalOpsTopBar
        clinicName={clinicName}
        professionalName={professionalName}
        notificationCount={core.notifications?.length ?? 0}
      />

      <div className="clinical-ops-grid grid gap-4 lg:grid-cols-[minmax(11rem,13rem)_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <ClinicalOpsLeftRail ops={core} />
        </div>

        <ClinicalOpsMainSectionsCore
          ops={core}
          canManageAppointments={canManageAppointments}
          secondary={secondary}
        />
      </div>

      <ClinicalOpsQuickActions />
    </section>
  );
}

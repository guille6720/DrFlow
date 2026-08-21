import type { ReactNode } from "react";

import { ClinicalOpsLeftRail } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-left-rail";
import { ClinicalOpsMainSectionsCore } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-main-sections-core";
import { ClinicalOpsRealtime } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-realtime";
import { ClinicalOpsTopBar } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-top-bar";
import { ClinicalOpsDashboardBoundary } from "@/features/dashboard/components/dashboard/clinical-ops-dashboard-boundary";
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
    <section
      aria-label="Centro de operaciones clínicas"
      className="clinical-ops-center drflow-ui-card space-y-4 p-4 text-slate-900"
    >
      <ClinicalOpsDashboardBoundary fallback={null}>
        <ClinicalOpsRealtime clinicId={clinicId} />
        <AdminOpsDashboardBridge
          ops={core}
          canManageCash={canManageCash}
          canManageWaitingRoom={canManageWaitingRoom}
          canManageSettings={canManageSettings}
        />
      </ClinicalOpsDashboardBoundary>

      <ClinicalOpsDashboardBoundary fallback={null}>
        <ClinicalOpsTopBar
          clinicName={clinicName}
          professionalName={professionalName}
          notificationCount={core.notifications?.length ?? 0}
        />
      </ClinicalOpsDashboardBoundary>

      <div className="clinical-ops-grid grid gap-4 lg:grid-cols-[minmax(11rem,13rem)_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <ClinicalOpsDashboardBoundary fallback={null}>
            <ClinicalOpsLeftRail ops={core} />
          </ClinicalOpsDashboardBoundary>
        </div>

        <ClinicalOpsMainSectionsCore
          ops={core}
          canManageAppointments={canManageAppointments}
          secondary={secondary}
        />
      </div>
    </section>
  );
}

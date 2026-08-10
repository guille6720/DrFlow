import { Suspense } from "react";

import { createClient } from "@/core/supabase/server";

import { ClinicalOpsCenter } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-center";
import { ClinicalOpsSecondarySections } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-secondary-sections";
import { ClinicalOpsSecondarySkeleton } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-secondary-skeleton";
import { ClinicalOpsDashboardBoundary } from "@/features/dashboard/components/dashboard/clinical-ops-dashboard-boundary";
import { ClinicalOpsLoadWarning } from "@/features/dashboard/components/dashboard/clinical-ops-load-warning";
import { loadClinicalOperationsDashboardCore } from "@/features/dashboard/server/load-clinical-operations-dashboard-core";
import {
  emptyClinicalOpsCorePayload,
  normalizeClinicalOpsCorePayload,
} from "@/features/dashboard/utils/normalize-clinical-ops-payload";

type Props = {
  clinicId: string;
  clinicName: string;
  professionalName?: string | null;
  canManageAppointments: boolean;
  canManageCash?: boolean;
  canManageWaitingRoom?: boolean;
  canManageSettings?: boolean;
};

export async function ClinicalOpsDashboardAsync({
  clinicId,
  clinicName,
  professionalName,
  canManageAppointments,
  canManageCash,
  canManageWaitingRoom,
  canManageSettings,
}: Props) {
  const supabase = await createClient();
  let coreRaw = emptyClinicalOpsCorePayload();
  let loadWarning: string | null = null;

  try {
    coreRaw = await loadClinicalOperationsDashboardCore(supabase, clinicId);
  } catch (err) {
    console.error("[clinical-ops-dashboard] core load failed", err);
    loadWarning =
      "No pudimos cargar operaciones del día. Refrescá la página o probá de nuevo en unos segundos.";
  }

  const core = normalizeClinicalOpsCorePayload(coreRaw);

  return (
    <div className="space-y-4">
      {loadWarning ? <ClinicalOpsLoadWarning message={loadWarning} /> : null}
      <ClinicalOpsDashboardBoundary>
        <ClinicalOpsCenter
        clinicId={clinicId}
        clinicName={clinicName}
        professionalName={professionalName}
        core={core}
        canManageAppointments={canManageAppointments}
        canManageCash={canManageCash}
        canManageWaitingRoom={canManageWaitingRoom}
        canManageSettings={canManageSettings}
        secondary={
          loadWarning ? null : (
            <Suspense fallback={<ClinicalOpsSecondarySkeleton />}>
              <ClinicalOpsSecondarySections clinicId={clinicId} core={coreRaw} />
            </Suspense>
          )
        }
        />
      </ClinicalOpsDashboardBoundary>
    </div>
  );
}

import { Suspense } from "react";

import { createClient } from "@/core/supabase/server";

import { ClinicalOpsCenter } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-center";
import { ClinicalOpsSecondarySections } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-secondary-sections";
import { ClinicalOpsSecondarySkeleton } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-secondary-skeleton";
import { safeLoadClinicalOperationsDashboardCore } from "@/features/dashboard/server/load-clinical-operations-dashboard-safe";
import { normalizeClinicalOpsCorePayload } from "@/features/dashboard/utils/normalize-clinical-ops-payload";

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
  const coreRaw = await safeLoadClinicalOperationsDashboardCore(supabase, clinicId);
  const core = normalizeClinicalOpsCorePayload(coreRaw);

  return (
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
        <Suspense fallback={<ClinicalOpsSecondarySkeleton />}>
          <ClinicalOpsSecondarySections clinicId={clinicId} core={coreRaw} />
        </Suspense>
      }
    />
  );
}

import { createClient } from "@/core/supabase/server";

import { ClinicalOpsTodayTasksSection } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-today-tasks-section";
import {
  LabResultsSection,
  PrescriptionsAndOrdersSections,
} from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-worklist-sections";
import { loadClinicalOperationsDashboardSecondary } from "@/features/dashboard/server/load-clinical-operations-dashboard-secondary";
import type { ClinicalOperationsDashboardCorePayload } from "@/features/dashboard/utils/clinical-operations-dashboard-types";

type Props = {
  clinicId: string;
  core: ClinicalOperationsDashboardCorePayload;
};

export async function ClinicalOpsSecondarySections({ clinicId, core }: Props) {
  const supabase = await createClient();
  const secondary = await loadClinicalOperationsDashboardSecondary(supabase, clinicId, core);

  return (
    <>
      <PrescriptionsAndOrdersSections
        draftPrescriptions={secondary.draftPrescriptions}
        pendingOrders={secondary.pendingOrders}
      />
      <LabResultsSection items={secondary.recentLabs} />
      <ClinicalOpsTodayTasksSection tasks={secondary.tasks} />
    </>
  );
}

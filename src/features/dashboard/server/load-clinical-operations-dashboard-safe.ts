import type { SupabaseClient } from "@supabase/supabase-js";

import { loadClinicalOperationsDashboardCore } from "@/features/dashboard/server/load-clinical-operations-dashboard-core";
import { loadClinicalOperationsDashboardSecondary } from "@/features/dashboard/server/load-clinical-operations-dashboard-secondary";
import type {
  ClinicalOperationsDashboardCorePayload,
  ClinicalOperationsDashboardSecondaryPayload,
} from "@/features/dashboard/utils/clinical-operations-dashboard-types";
import {
  emptyClinicalOpsCorePayload,
  emptyClinicalOpsSecondaryPayload,
  normalizeClinicalOpsSecondaryPayload,
} from "@/features/dashboard/utils/normalize-clinical-ops-payload";

export async function safeLoadClinicalOperationsDashboardCore(
  supabase: SupabaseClient,
  clinicId: string
): Promise<ClinicalOperationsDashboardCorePayload> {
  try {
    return await loadClinicalOperationsDashboardCore(supabase, clinicId);
  } catch (err) {
    console.error("[dashboard] core load failed", err);
    return emptyClinicalOpsCorePayload();
  }
}

export async function safeLoadClinicalOperationsDashboardSecondary(
  supabase: SupabaseClient,
  clinicId: string,
  core: ClinicalOperationsDashboardCorePayload
): Promise<ClinicalOperationsDashboardSecondaryPayload> {
  try {
    const secondary = await loadClinicalOperationsDashboardSecondary(supabase, clinicId, core);
    return normalizeClinicalOpsSecondaryPayload(secondary);
  } catch (err) {
    console.error("[dashboard] secondary load failed", err);
    return emptyClinicalOpsSecondaryPayload();
  }
}

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  countsTowardAutomationsMaxActive,
  isAutomationLikeClinicJobRow,
} from "@/core/entitlements/automation-jobs";
import { isAutomationLimitEnforced } from "@/core/entitlements/enforcement";
import { getClinicEntitlements } from "@/core/entitlements/entitlements.server";
import { FEATURES } from "@/core/entitlements/features";
import { decideSeatCapacity } from "@/core/entitlements/limits";
import { lookupFeature } from "@/core/entitlements/resolve";
import { createClient } from "@/core/supabase/server";

/** null = unknown (fail open). */
export async function countActiveAutomationJobs(
  supabase: SupabaseClient,
  clinicId: string
): Promise<number | null> {
  const { data, error } = await supabase
    .from("clinic_jobs")
    .select("job_type, payload")
    .eq("clinic_id", clinicId)
    .in("status", ["pending", "running"]);

  if (error) return null;
  return (data ?? []).filter(isAutomationLikeClinicJobRow).length;
}

export async function assertAutomationJobCapacity(args: {
  clinicId: string;
  jobType: string;
  payload?: Record<string, unknown> | null;
  supabase?: SupabaseClient;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!countsTowardAutomationsMaxActive(args.jobType, args.payload)) return { ok: true };
  if (!isAutomationLimitEnforced()) return { ok: true };

  const entitlements = await getClinicEntitlements({ clinicId: args.clinicId });
  const supabase = args.supabase ?? (await createClient());
  const currentCount = await countActiveAutomationJobs(supabase, args.clinicId);
  if (currentCount === null) return { ok: true };

  return decideSeatCapacity({
    enforced: true,
    catalogAvailable: entitlements.catalogAvailable,
    limit: lookupFeature(entitlements, FEATURES.AUTOMATIONS_MAX_ACTIVE)?.limit,
    currentCount,
    extra: 1,
    featureKey: FEATURES.AUTOMATIONS_MAX_ACTIVE,
  });
}

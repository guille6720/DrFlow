import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isSeatLimitEnforced } from "@/core/entitlements/enforcement";
import { getClinicEntitlements } from "@/core/entitlements/entitlements.server";
import { parseEntitlementsPayload } from "@/core/entitlements/entitlements-payload";
import { type FeatureKey, FEATURES } from "@/core/entitlements/features";
import { decideSeatCapacity, remainingSeatHeadroom } from "@/core/entitlements/limits";
import { lookupFeature } from "@/core/entitlements/resolve";
import { createClient } from "@/core/supabase/server";

type SeatFeatureKey =
  | typeof FEATURES.USERS_MAX
  | typeof FEATURES.PROFESSIONALS_MAX
  | typeof FEATURES.PATIENTS_MAX;

export async function countClinicSeatRows(
  supabase: SupabaseClient,
  featureKey: SeatFeatureKey,
  clinicId: string
): Promise<number> {
  if (featureKey === FEATURES.USERS_MAX) {
    const [{ count: members }, { count: pending }] = await Promise.all([
      supabase
        .from("clinic_members")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .eq("is_active", true),
      supabase
        .from("clinic_invitations")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .eq("status", "pending"),
    ]);
    return (members ?? 0) + (pending ?? 0);
  }

  if (featureKey === FEATURES.PROFESSIONALS_MAX) {
    const { count } = await supabase
      .from("professionals")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId);
    return count ?? 0;
  }

  const { count } = await supabase
    .from("patients")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId);
  return count ?? 0;
}

export async function assertClinicSeatCapacity(args: {
  clinicId: string;
  featureKey: SeatFeatureKey;
  extra?: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSeatLimitEnforced(args.featureKey)) return { ok: true };

  const entitlements = await getClinicEntitlements({ clinicId: args.clinicId });
  const resolved = lookupFeature(entitlements, args.featureKey as FeatureKey);
  const supabase = await createClient();
  const currentCount = await countClinicSeatRows(supabase, args.featureKey, args.clinicId);

  return decideSeatCapacity({
    enforced: true,
    catalogAvailable: entitlements.catalogAvailable,
    limit: resolved ? resolved.limit : undefined,
    currentCount,
    extra: args.extra ?? 1,
    featureKey: args.featureKey,
  });
}

/**
 * Remaining patient creates allowed for this clinic.
 * null = unlimited or fail-open (catalog/RPC missing).
 */
export async function getPatientCreateHeadroom(args: {
  clinicId: string;
  supabase: SupabaseClient;
}): Promise<number | null> {
  if (!isSeatLimitEnforced(FEATURES.PATIENTS_MAX)) return null;

  const { data, error } = await args.supabase.rpc("get_clinic_entitlements", {
    p_clinic_id: args.clinicId,
  });
  if (error) return null;

  const entitlements = parseEntitlementsPayload(data, args.clinicId);
  const resolved = lookupFeature(entitlements, FEATURES.PATIENTS_MAX);
  const currentCount = await countClinicSeatRows(
    args.supabase,
    FEATURES.PATIENTS_MAX,
    args.clinicId
  );

  return remainingSeatHeadroom(
    entitlements.catalogAvailable,
    true,
    resolved ? resolved.limit : undefined,
    currentCount
  );
}

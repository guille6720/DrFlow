import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveClinicFeatureFlags,
  buildClinicFeaturesContext,
  type ClinicFeaturesContext,
  type ResolvedClinicFeatureFlags,
} from "@/features/flags/lib/resolve";
import { FEATURE_FLAG_REGISTRY } from "@/features/flags/lib/registry";
import { loadClinicPlugins } from "@/lib/server/load-clinic-plugins";

export async function loadClinicFeatureFlags(
  supabase: SupabaseClient,
  clinicId: string
): Promise<ResolvedClinicFeatureFlags> {
  const { data } = await supabase
    .from("clinic_feature_flags")
    .select("flag_id, enabled")
    .eq("clinic_id", clinicId);

  return resolveClinicFeatureFlags(data ?? []);
}

export async function loadClinicFeatures(
  supabase: SupabaseClient,
  clinicId: string
): Promise<ClinicFeaturesContext> {
  const [plugins, flags] = await Promise.all([
    loadClinicPlugins(supabase, clinicId),
    loadClinicFeatureFlags(supabase, clinicId),
  ]);
  return buildClinicFeaturesContext(plugins, flags);
}

export async function seedDefaultClinicFeatureFlags(
  supabase: SupabaseClient,
  clinicId: string
) {
  const rows = FEATURE_FLAG_REGISTRY.map((f) => ({
    clinic_id: clinicId,
    flag_id: f.id,
    enabled: f.defaultEnabled,
  }));

  await supabase.from("clinic_feature_flags").upsert(rows, {
    onConflict: "clinic_id,flag_id",
    ignoreDuplicates: true,
  });
}

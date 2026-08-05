import type { SupabaseClient } from "@supabase/supabase-js";

import { PLUGIN_REGISTRY } from "@/plugins/registry";
import {
  resolveClinicPlugins,
  type ResolvedClinicPlugins,
} from "@/plugins/resolve";

export async function loadClinicPlugins(
  supabase: SupabaseClient,
  clinicId: string
): Promise<ResolvedClinicPlugins> {
  const { data } = await supabase
    .from("clinic_plugins")
    .select("plugin_id, enabled")
    .eq("clinic_id", clinicId);

  return resolveClinicPlugins(data ?? []);
}

/** Ensures default plugin rows exist for a new clinic. */
export async function seedDefaultClinicPlugins(
  supabase: SupabaseClient,
  clinicId: string
) {
  const rows = PLUGIN_REGISTRY.map((p) => ({
    clinic_id: clinicId,
    plugin_id: p.id,
    enabled: p.defaultEnabled,
  }));

  await supabase.from("clinic_plugins").upsert(rows, {
    onConflict: "clinic_id,plugin_id",
    ignoreDuplicates: true,
  });
}

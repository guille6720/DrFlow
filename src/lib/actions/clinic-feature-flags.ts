"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/core/supabase/server";
import { getActiveClinicId, getSession, logAudit } from "@/core/auth/session";
import { requireClinicPermission } from "@/core/actions/clinic-guard";
import {
  getFeatureFlagDefinition,
  listFeatureFlags,
  type FeatureFlagId,
} from "@/features/flags/lib/registry";

export async function updateClinicFeatureFlag(
  flagId: FeatureFlagId,
  enabled: boolean
): Promise<{ success?: true; error?: string }> {
  const access = await requireClinicPermission("manageSettings");
  if (!access.ok) return { error: access.error };

  getFeatureFlagDefinition(flagId);

  const user = await getSession();
  if (!user) return { error: "Sin sesión" };

  const clinicId = await getActiveClinicId();
  if (!clinicId) return { error: "Sin clínica activa" };

  const supabase = await createClient();
  const { error } = await supabase.from("clinic_feature_flags").upsert(
    {
      clinic_id: clinicId,
      flag_id: flagId,
      enabled,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clinic_id,flag_id" }
  );

  if (error) return { error: "No se pudo actualizar la función" };

  await logAudit({
    clinicId,
    entityType: "feature_flag",
    action: "update",
    metadata: { flag_id: flagId, enabled },
  });

  revalidatePath("/configuracion");
  revalidatePath("/", "layout");

  return { success: true };
}

export async function getClinicFeatureFlagSettings(): Promise<{
  data?: Array<{
    id: FeatureFlagId;
    label: string;
    description: string;
    category: string;
    enabled: boolean;
    requiresPlugin?: string;
  }>;
  error?: string;
}> {
  const access = await requireClinicPermission("manageSettings");
  if (!access.ok) return { error: access.error };

  const clinicId = await getActiveClinicId();
  if (!clinicId) return { error: "Sin clínica activa" };

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("clinic_feature_flags")
    .select("flag_id, enabled")
    .eq("clinic_id", clinicId);

  return {
    data: listFeatureFlags().map((def) => {
      const row = rows?.find((r) => r.flag_id === def.id);
      return {
        id: def.id,
        label: def.label,
        description: def.description,
        category: def.category,
        enabled: row?.enabled ?? def.defaultEnabled,
        requiresPlugin: def.requiresPlugin,
      };
    }),
  };
}

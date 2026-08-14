"use server";

import { revalidatePath } from "next/cache";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { logAudit } from "@/core/auth/session.actions";
import { getActiveClinicId, getSession } from "@/core/auth/session.server";
import { revalidateClinicFeatureFlagsCache } from "@/core/cache/revalidate-clinic-cache";
import { createClient } from "@/core/supabase/server";

import {
  type FeatureFlagId,
  getFeatureFlagDefinition,
  listFeatureFlags,
} from "@/features/flags/lib/registry";

import { getCachedClinicFeatureFlags } from "@/lib/server/cached-clinic-queries";

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

  revalidateClinicFeatureFlagsCache(clinicId);
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

  const flags = await getCachedClinicFeatureFlags(clinicId);
  return {
    data: listFeatureFlags().map((def) => ({
      id: def.id,
      label: def.label,
      description: def.description,
      category: def.category,
      enabled: flags[def.id] ?? def.defaultEnabled,
      requiresPlugin: def.requiresPlugin,
    })),
  };
}

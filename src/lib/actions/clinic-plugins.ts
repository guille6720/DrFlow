"use server";

import { revalidatePath } from "next/cache";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { getActiveClinicId, getSession } from "@/core/auth/session.server";
import { logAudit } from "@/core/auth/session.actions";
import { revalidateClinicPluginsCache } from "@/core/cache/revalidate-clinic-cache";
import { createClient } from "@/core/supabase/server";

import { getCachedClinicPlugins } from "@/lib/server/cached-clinic-queries";
import {
  getPluginDefinition,
  listToggleablePlugins,
  type PluginId,
} from "@/plugins/registry";

export async function updateClinicPlugin(
  pluginId: PluginId,
  enabled: boolean
): Promise<{ success?: true; error?: string }> {
  const access = await requireClinicPermission("manageSettings");
  if (!access.ok) return { error: access.error };

  const def = getPluginDefinition(pluginId);
  if (def.tier === "planned") {
    return { error: "Este plugin aún no está disponible" };
  }

  const user = await getSession();
  if (!user) return { error: "Sin sesión" };

  const clinicId = await getActiveClinicId();
  if (!clinicId) return { error: "Sin clínica activa" };

  const supabase = await createClient();
  const { error } = await supabase.from("clinic_plugins").upsert(
    {
      clinic_id: clinicId,
      plugin_id: pluginId,
      enabled,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clinic_id,plugin_id" }
  );

  if (error) return { error: "No se pudo actualizar el plugin" };

  if (pluginId === "voice") {
    await supabase
      .from("clinics")
      .update({ voice_input_enabled: enabled })
      .eq("id", clinicId);
  }

  await logAudit({
    clinicId,
    entityType: "clinic_plugin",
    action: "update",
    metadata: { plugin_id: pluginId, enabled },
  });

  revalidateClinicPluginsCache(clinicId);
  revalidatePath("/configuracion");
  revalidatePath("/", "layout");

  return { success: true };
}

export async function getClinicPluginSettings(): Promise<{
  data?: Array<{ id: PluginId; label: string; description: string; tier: string; enabled: boolean }>;
  error?: string;
}> {
  const access = await requireClinicPermission("manageSettings");
  if (!access.ok) return { error: access.error };

  const clinicId = await getActiveClinicId();
  if (!clinicId) return { error: "Sin clínica activa" };

  const plugins = await getCachedClinicPlugins(clinicId);
  const toggleable = listToggleablePlugins();
  return {
    data: toggleable.map((def) => {
      const row = plugins[def.id as PluginId];
      return {
        id: def.id,
        label: def.label,
        description: def.description,
        tier: def.tier,
        enabled: row ?? def.defaultEnabled,
      };
    }),
  };
}

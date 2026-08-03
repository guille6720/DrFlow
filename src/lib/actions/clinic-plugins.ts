"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveClinicId, getSession, logAudit } from "@/lib/auth/session";
import { requireClinicPermission } from "@/lib/actions/clinic-guard";
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

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("clinic_plugins")
    .select("plugin_id, enabled")
    .eq("clinic_id", clinicId);

  const toggleable = listToggleablePlugins();
  return {
    data: toggleable.map((def) => {
      const row = rows?.find((r) => r.plugin_id === def.id);
      return {
        id: def.id,
        label: def.label,
        description: def.description,
        tier: def.tier,
        enabled: row?.enabled ?? def.defaultEnabled,
      };
    }),
  };
}

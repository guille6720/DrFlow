"use server";

import { revalidatePath } from "next/cache";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { getSession } from "@/core/auth/session.server";
import { FEATURES } from "@/core/entitlements/features";
import { requirePermissionAndAddon } from "@/core/entitlements/guard.server";
import { generatePublicApiKeyMaterial } from "@/core/public-api/auth";
import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";
import { firstZodIssue, parseEntityId } from "@/core/validations/params";
import { createApiKeySchema, revokeApiKeySchema } from "@/core/validations/public-api-schemas";

export type ClinicApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export async function listClinicApiKeys(clinicId: string): Promise<ClinicApiKeyRow[]> {
  const supabase = await (await import("@/core/supabase/server")).createClient();
  const { data } = await supabase
    .from("clinic_api_keys")
    .select("id, name, key_prefix, scopes, is_active, last_used_at, expires_at, created_at")
    .eq("clinic_id", clinicId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  return (data ?? []) as ClinicApiKeyRow[];
}

export async function createClinicApiKey(formData: FormData) {
  const access = await requirePermissionAndAddon("manageSettings", FEATURES.API);
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;
  const user = await getSession();

  if (!hasAdminClient()) {
    return { error: "API no disponible — falta SUPABASE_SERVICE_ROLE_KEY" };
  }

  const raw = Object.fromEntries(formData.entries());
  const scopesRaw = formData.getAll("scopes").map(String);
  const parsed = createApiKeySchema.safeParse({ ...raw, scopes: scopesRaw });
  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const { secret, prefix, hash } = generatePublicApiKeyMaterial();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("clinic_api_keys")
    .insert({
      clinic_id: clinicId,
      name: parsed.data.name.trim(),
      key_prefix: prefix,
      key_hash: hash,
      scopes: parsed.data.scopes,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await admin.from("clinic_plugins").upsert(
    { clinic_id: clinicId, plugin_id: "public_api", enabled: true },
    { onConflict: "clinic_id,plugin_id" }
  );

  revalidatePath("/configuracion");
  return { success: true, secret, keyId: data.id };
}

export async function revokeClinicApiKey(formData: FormData) {
  const access = await requireClinicPermission("manageSettings");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;

  const raw = Object.fromEntries(formData.entries());
  const parsed = revokeApiKeySchema.safeParse(raw);
  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const idParsed = parseEntityId(parsed.data.id, "Clave API");
  if (!idParsed.ok) return { error: idParsed.error };

  const supabase = await (await import("@/core/supabase/server")).createClient();
  const { error } = await supabase
    .from("clinic_api_keys")
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
    })
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };

  revalidatePath("/configuracion");
  return { success: true };
}

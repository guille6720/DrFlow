import "server-only";

import { getActiveClinicId } from "@/core/auth/session";
import { createClient } from "@/core/supabase/server";

import type {
  UserAiConnectionPublic,
  UserAiCredentials,
  UserAiProviderId,
} from "@/lib/ai/user-ai-provider-types";
import { getDefaultModelForProvider, maskUserAiApiKey } from "@/lib/ai/user-ai-provider-types";

type DbRow = {
  provider: UserAiProviderId;
  api_key: string;
  base_url: string | null;
  model: string;
  label: string | null;
  updated_at: string;
};

function toPublic(row: DbRow): UserAiConnectionPublic {
  return {
    provider: row.provider,
    model: row.model,
    label: row.label,
    baseUrl: row.base_url,
    keyHint: maskUserAiApiKey(row.api_key),
    updatedAt: row.updated_at,
  };
}

export async function getClinicSharedAiConnectionPublic(): Promise<UserAiConnectionPublic | null> {
  const clinicId = await getActiveClinicId();
  if (!clinicId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_shared_ai_connections")
    .select("provider, api_key, base_url, model, label, updated_at")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (error || !data?.api_key?.trim()) return null;
  return toPublic(data as DbRow);
}

export async function getClinicSharedAiCredentialsForSession(): Promise<UserAiCredentials | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const clinicId = await getActiveClinicId();
  if (!clinicId) return null;

  const { data: member } = await supabase
    .from("clinic_members")
    .select("uses_shared_ai")
    .eq("clinic_id", clinicId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!member?.uses_shared_ai) return null;

  const { data, error } = await supabase
    .from("clinic_shared_ai_connections")
    .select("provider, api_key, base_url, model")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (error || !data?.api_key?.trim()) return null;

  return {
    provider: data.provider as UserAiProviderId,
    apiKey: data.api_key.trim(),
    baseUrl: data.base_url,
    model: data.model?.trim() || getDefaultModelForProvider(data.provider as UserAiProviderId),
  };
}

export async function saveClinicSharedAiConnection(input: {
  provider: UserAiProviderId;
  apiKey?: string;
  baseUrl?: string | null;
  model?: string | null;
  label?: string | null;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión expirada" };

  const clinicId = await getActiveClinicId();
  if (!clinicId) return { error: "Sin clínica activa" };

  const apiKey = input.apiKey?.trim() ?? "";
  const model = input.model?.trim() || getDefaultModelForProvider(input.provider);

  let keyToStore = apiKey;
  if (apiKey.length < 8) {
    const { data: existing } = await supabase
      .from("clinic_shared_ai_connections")
      .select("api_key")
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (!existing?.api_key?.trim()) {
      return { error: "API key inválida" };
    }
    keyToStore = existing.api_key.trim();
  }

  const { error } = await supabase.from("clinic_shared_ai_connections").upsert(
    {
      clinic_id: clinicId,
      provider: input.provider,
      api_key: keyToStore,
      base_url: input.baseUrl?.trim() || null,
      model,
      label: input.label?.trim() || null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clinic_id" }
  );

  if (error) return { error: error.message };
  return {};
}

export async function deleteClinicSharedAiConnection(): Promise<{ error?: string }> {
  const clinicId = await getActiveClinicId();
  if (!clinicId) return { error: "Sin clínica activa" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("clinic_shared_ai_connections")
    .delete()
    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };
  return {};
}

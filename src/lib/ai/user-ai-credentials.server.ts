import "server-only";

import { resolvePostgresUserMessage } from "@/core/errors/postgres-error";
import { createClient } from "@/core/supabase/server";

import { getClinicSharedAiCredentialsForSession } from "@/lib/ai/clinic-shared-ai.server";
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

/** Returns the authenticated user's AI credentials for server-side LLM calls. */
export async function getUserAiCredentialsForSession(): Promise<UserAiCredentials | null> {
  const shared = await getClinicSharedAiCredentialsForSession();
  if (shared) return shared;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_ai_connections")
    .select("provider, api_key, base_url, model")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data?.api_key?.trim()) return null;

  return {
    provider: data.provider as UserAiProviderId,
    apiKey: data.api_key.trim(),
    baseUrl: data.base_url,
    model: data.model?.trim() || getDefaultModelForProvider(data.provider as UserAiProviderId),
  };
}

/** Public connection summary — never returns the API key. */
export async function getUserAiConnectionPublic(): Promise<UserAiConnectionPublic | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_ai_connections")
    .select("provider, api_key, base_url, model, label, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data?.api_key?.trim()) return null;
  return toPublic(data as DbRow);
}

export async function saveUserAiConnection(input: {
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

  const apiKey = input.apiKey?.trim() ?? "";
  const model = input.model?.trim() || getDefaultModelForProvider(input.provider);

  let keyToStore = apiKey;
  if (apiKey.length < 8) {
    const { data: existing } = await supabase
      .from("user_ai_connections")
      .select("api_key")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existing?.api_key?.trim()) {
      return { error: "API key inválida" };
    }
    keyToStore = existing.api_key.trim();
  }

  const { error } = await supabase.from("user_ai_connections").upsert(
    {
      user_id: user.id,
      provider: input.provider,
      api_key: keyToStore,
      base_url: input.baseUrl?.trim() || null,
      model,
      label: input.label?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) return { error: formatUserAiConnectionError(error) };
  return {};
}

function formatUserAiConnectionError(error: { code?: string; message?: string; details?: string; hint?: string }): string {
  return resolvePostgresUserMessage(error, { fallback: error.message ?? "Error de conexión AI" });
}

export async function deleteUserAiConnection(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión expirada" };

  const { error } = await supabase.from("user_ai_connections").delete().eq("user_id", user.id);
  if (error) return { error: formatUserAiConnectionError(error) };
  return {};
}

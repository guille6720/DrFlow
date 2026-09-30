import "server-only";

import { type FeatureKey, getFeatureDefinition, isFeatureKey } from "@/core/customizations/registry";
import {
  type FeatureMap,
  type FeatureSettingRow,
  resolveFeatureMap,
  validateFeatureConfig,
} from "@/core/customizations/resolve";
import { requireSuperadminOrDeny } from "@/core/entitlements/superadmin-guard.server";
import { KNOWN_SUPABASE_PROJECTS } from "@/core/environment/isolation.mjs";
import { asStagingSchemaClient } from "@/core/products/staging-schema-client";
import { createClient } from "@/core/supabase/server";

const PRODUCTION_SUPABASE_REF = KNOWN_SUPABASE_PROJECTS.production;
const STAGING_SUPABASE_REF = KNOWN_SUPABASE_PROJECTS.staging;
const MAX_CONFIG_BYTES = 8192;

export type CustomizationEnvironment = "production" | "staging" | "preview" | "development" | "unknown";

/** Derived server-side from the Supabase project the server is connected to. */
export function getCustomizationEnvironment(): CustomizationEnvironment {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (url.includes(PRODUCTION_SUPABASE_REF)) return "production";
  if (url.includes(STAGING_SUPABASE_REF)) return "staging";
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "production" || vercelEnv === "preview" || vercelEnv === "development") {
    return vercelEnv;
  }
  return process.env.NODE_ENV === "development" ? "development" : "unknown";
}

export interface CustomizationClinicOption {
  id: string;
  name: string;
}

export interface CustomizationMemberOption {
  userId: string;
  fullName: string;
  role: string;
}

export interface AdminCustomizationState {
  available: boolean;
  clinicRows: FeatureSettingRow[];
  userRows: FeatureSettingRow[];
  clinicResolved: FeatureMap;
  userResolved: FeatureMap | null;
}

export async function listCustomizationClinics(): Promise<CustomizationClinicOption[]> {
  const access = await requireSuperadminOrDeny();
  if (!access.ok) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("clinics").select("id, name").order("name").limit(2000);
  return (data ?? []).map((c) => ({ id: c.id, name: c.name ?? "Sin nombre" }));
}

/** Only active members of the selected clinic (never users from other tenants). */
export async function listCustomizationMembers(
  clinicId: string
): Promise<CustomizationMemberOption[]> {
  const access = await requireSuperadminOrDeny();
  if (!access.ok || !clinicId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("clinic_members")
    .select("user_id, role, profiles(full_name)")
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .limit(500);
  return (data ?? []).map((m) => {
    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return {
      userId: m.user_id,
      fullName: profile?.full_name?.trim() || "Sin nombre",
      role: String(m.role),
    };
  });
}

export async function loadAdminCustomizationState(
  clinicId: string,
  userId: string | null
): Promise<AdminCustomizationState> {
  const empty: AdminCustomizationState = {
    available: false,
    clinicRows: [],
    userRows: [],
    clinicResolved: resolveFeatureMap(null),
    userResolved: userId ? resolveFeatureMap(null) : null,
  };
  const access = await requireSuperadminOrDeny();
  if (!access.ok || !clinicId) return empty;

  const supabase = asStagingSchemaClient(await createClient());
  const [clinicRes, userRes] = await Promise.all([
    supabase
      .from("clinic_feature_settings")
      .select("feature_key, enabled, config")
      .eq("clinic_id", clinicId),
    userId
      ? supabase
          .from("user_feature_settings")
          .select("feature_key, enabled, config")
          .eq("clinic_id", clinicId)
          .eq("user_id", userId)
      : Promise.resolve({ data: [], error: null, count: null }),
  ]);
  if (clinicRes.error || userRes.error) return empty;

  const clinicRows = (clinicRes.data ?? []) as unknown as FeatureSettingRow[];
  const userRows = (userRes.data ?? []) as unknown as FeatureSettingRow[];
  return {
    available: true,
    clinicRows,
    userRows,
    clinicResolved: resolveFeatureMap({ clinic: clinicRows }),
    userResolved: userId ? resolveFeatureMap({ clinic: clinicRows, user: userRows }) : null,
  };
}

export type CustomizationMutationResult = { ok: true } | { ok: false; error: string };

const RPC_ERROR_MESSAGES: Record<string, string> = {
  FORBIDDEN: "Solo el Superadmin puede modificar personalizaciones.",
  NOT_AUTHENTICATED: "Sesión expirada.",
  UNKNOWN_FEATURE: "Funcionalidad desconocida.",
  NOT_CONFIGURABLE_BY_CLINIC: "Esta funcionalidad no se configura por clínica.",
  NOT_CONFIGURABLE_BY_USER: "Esta funcionalidad no admite override por usuario.",
  USER_NOT_IN_CLINIC: "El usuario no pertenece a la clínica seleccionada.",
  INVALID_CONFIG: "Configuración inválida.",
  CONFIG_TOO_LARGE: "Configuración demasiado grande.",
  EMPTY_SETTING: "Nada para guardar.",
  CLINIC_NOT_FOUND: "Clínica inexistente.",
};

function mapRpcError(message: string | undefined): string {
  const msg = message ?? "";
  for (const [code, text] of Object.entries(RPC_ERROR_MESSAGES)) {
    if (msg.includes(code)) return text;
  }
  return "No se pudo guardar la personalización.";
}

type SettingInput = {
  clinicId: string;
  userId?: string | null;
  featureKey: string;
  enabled: boolean | null;
  config: unknown;
  reason?: string;
};

function validateSettingInput(
  input: SettingInput,
  scope: "clinic" | "user"
): { ok: true; key: FeatureKey; config: Record<string, unknown> | null } | { ok: false; error: string } {
  if (!isFeatureKey(input.featureKey)) return { ok: false, error: "Funcionalidad desconocida." };
  const def = getFeatureDefinition(input.featureKey);
  if (scope === "clinic" && !def.configurableByClinic) {
    return { ok: false, error: RPC_ERROR_MESSAGES.NOT_CONFIGURABLE_BY_CLINIC };
  }
  if (scope === "user" && !def.configurableByUser) {
    return { ok: false, error: RPC_ERROR_MESSAGES.NOT_CONFIGURABLE_BY_USER };
  }
  let config: Record<string, unknown> | null = null;
  if (input.config != null) {
    const validated = validateFeatureConfig(input.featureKey, input.config);
    if (!validated.ok) {
      const where = validated.paths.filter(Boolean).join(", ");
      return { ok: false, error: `Configuración inválida${where ? ` (${where})` : ""}.` };
    }
    if (JSON.stringify(validated.config).length > MAX_CONFIG_BYTES) {
      return { ok: false, error: RPC_ERROR_MESSAGES.CONFIG_TOO_LARGE };
    }
    config = Object.keys(validated.config).length > 0 ? validated.config : null;
  }
  if (input.enabled === null && config === null) {
    return { ok: false, error: RPC_ERROR_MESSAGES.EMPTY_SETTING };
  }
  return { ok: true, key: input.featureKey, config };
}

export async function setClinicFeatureSetting(input: SettingInput): Promise<CustomizationMutationResult> {
  const access = await requireSuperadminOrDeny();
  if (!access.ok) return { ok: false, error: RPC_ERROR_MESSAGES.FORBIDDEN };
  const v = validateSettingInput(input, "clinic");
  if (!v.ok) return v;
  const supabase = asStagingSchemaClient(await createClient());
  const { error } = await supabase.rpc("set_clinic_feature_setting", {
    p_clinic_id: input.clinicId,
    p_feature_key: v.key,
    p_enabled: input.enabled,
    p_config: v.config,
    p_reason: input.reason?.slice(0, 500) ?? null,
    p_environment: getCustomizationEnvironment(),
  });
  return error ? { ok: false, error: mapRpcError(error.message) } : { ok: true };
}

export async function clearClinicFeatureSetting(input: {
  clinicId: string;
  featureKey: string;
  reason?: string;
}): Promise<CustomizationMutationResult> {
  const access = await requireSuperadminOrDeny();
  if (!access.ok) return { ok: false, error: RPC_ERROR_MESSAGES.FORBIDDEN };
  if (!isFeatureKey(input.featureKey)) return { ok: false, error: "Funcionalidad desconocida." };
  const supabase = asStagingSchemaClient(await createClient());
  const { error } = await supabase.rpc("clear_clinic_feature_setting", {
    p_clinic_id: input.clinicId,
    p_feature_key: input.featureKey,
    p_reason: input.reason?.slice(0, 500) ?? null,
    p_environment: getCustomizationEnvironment(),
  });
  return error ? { ok: false, error: mapRpcError(error.message) } : { ok: true };
}

export async function setUserFeatureSetting(input: SettingInput): Promise<CustomizationMutationResult> {
  const access = await requireSuperadminOrDeny();
  if (!access.ok) return { ok: false, error: RPC_ERROR_MESSAGES.FORBIDDEN };
  if (!input.userId) return { ok: false, error: "Usuario requerido." };
  const v = validateSettingInput(input, "user");
  if (!v.ok) return v;
  const supabase = asStagingSchemaClient(await createClient());
  const { error } = await supabase.rpc("set_user_feature_setting", {
    p_clinic_id: input.clinicId,
    p_user_id: input.userId,
    p_feature_key: v.key,
    p_enabled: input.enabled,
    p_config: v.config,
    p_reason: input.reason?.slice(0, 500) ?? null,
    p_environment: getCustomizationEnvironment(),
  });
  return error ? { ok: false, error: mapRpcError(error.message) } : { ok: true };
}

export async function clearUserFeatureSetting(input: {
  clinicId: string;
  userId: string;
  featureKey: string;
  reason?: string;
}): Promise<CustomizationMutationResult> {
  const access = await requireSuperadminOrDeny();
  if (!access.ok) return { ok: false, error: RPC_ERROR_MESSAGES.FORBIDDEN };
  if (!isFeatureKey(input.featureKey)) return { ok: false, error: "Funcionalidad desconocida." };
  const supabase = asStagingSchemaClient(await createClient());
  const { error } = await supabase.rpc("clear_user_feature_setting", {
    p_clinic_id: input.clinicId,
    p_user_id: input.userId,
    p_feature_key: input.featureKey,
    p_reason: input.reason?.slice(0, 500) ?? null,
    p_environment: getCustomizationEnvironment(),
  });
  return error ? { ok: false, error: mapRpcError(error.message) } : { ok: true };
}

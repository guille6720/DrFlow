"use server";

import { revalidatePath } from "next/cache";

import {
  clearClinicFeatureSetting,
  clearUserFeatureSetting,
  type CustomizationMutationResult,
  setClinicFeatureSetting,
  setUserFeatureSetting,
} from "@/core/customizations/admin.server";
import { getFeatureDefinition, isFeatureKey } from "@/core/customizations/registry";
import { requireSuperadminOrDeny } from "@/core/entitlements/superadmin-guard.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SaveCustomizationInput {
  clinicId: string;
  userId?: string | null;
  featureKey: string;
  enabled: boolean | null;
  /** JSON text from the editor; parsed server-side, never evaluated. */
  configJson?: string | null;
  reason?: string;
  confirmCritical?: boolean;
}

function parseConfigJson(raw: string | null | undefined):
  | { ok: true; value: unknown }
  | { ok: false; error: string } {
  const text = raw?.trim();
  if (!text) return { ok: true, value: null };
  if (text.length > 8192) return { ok: false, error: "Configuración demasiado grande." };
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, error: "El JSON de configuración no es válido." };
  }
}

function precheck(input: {
  clinicId: string;
  userId?: string | null;
  featureKey: string;
  confirmCritical?: boolean;
}): CustomizationMutationResult {
  if (!UUID_RE.test(input.clinicId)) return { ok: false, error: "Clínica inválida." };
  if (input.userId != null && input.userId !== "" && !UUID_RE.test(input.userId)) {
    return { ok: false, error: "Usuario inválido." };
  }
  if (!isFeatureKey(input.featureKey)) return { ok: false, error: "Funcionalidad desconocida." };
  if (getFeatureDefinition(input.featureKey).critical && input.confirmCritical !== true) {
    return { ok: false, error: "Cambio crítico: se requiere confirmación explícita." };
  }
  return { ok: true };
}

function revalidate(clinicId: string) {
  revalidatePath("/superadmin/customizations");
  revalidatePath(`/superadmin/clinics/${clinicId}`);
}

export async function saveFeatureCustomizationAction(
  input: SaveCustomizationInput
): Promise<CustomizationMutationResult> {
  const access = await requireSuperadminOrDeny();
  if (!access.ok) return { ok: false, error: "Solo el Superadmin puede modificar personalizaciones." };
  const pre = precheck(input);
  if (!pre.ok) return pre;
  const config = parseConfigJson(input.configJson);
  if (!config.ok) return config;

  const payload = {
    clinicId: input.clinicId,
    userId: input.userId || null,
    featureKey: input.featureKey,
    enabled: typeof input.enabled === "boolean" ? input.enabled : null,
    config: config.value,
    reason: input.reason?.trim() || undefined,
  };
  const result = payload.userId
    ? await setUserFeatureSetting(payload)
    : await setClinicFeatureSetting(payload);
  if (result.ok) revalidate(input.clinicId);
  return result;
}

export async function resetFeatureCustomizationAction(input: {
  clinicId: string;
  userId?: string | null;
  featureKey: string;
  reason?: string;
  confirmCritical?: boolean;
}): Promise<CustomizationMutationResult> {
  const access = await requireSuperadminOrDeny();
  if (!access.ok) return { ok: false, error: "Solo el Superadmin puede modificar personalizaciones." };
  const pre = precheck(input);
  if (!pre.ok) return pre;
  const reason = input.reason?.trim() || undefined;
  const result = input.userId
    ? await clearUserFeatureSetting({
        clinicId: input.clinicId,
        userId: input.userId,
        featureKey: input.featureKey,
        reason,
      })
    : await clearClinicFeatureSetting({ clinicId: input.clinicId, featureKey: input.featureKey, reason });
  if (result.ok) revalidate(input.clinicId);
  return result;
}

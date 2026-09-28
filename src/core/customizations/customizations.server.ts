import "server-only";

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { cache } from "react";

import { logAudit } from "@/core/auth/session.actions";
import { type FeatureKey, isFeatureKey } from "@/core/customizations/registry";
import {
  defaultCustomizationsSnapshot,
  type FeatureCustomizationsSnapshot,
  type FeatureSettingsPayload,
  getFeatureConfigFromMap,
  isFeatureEnabledInMap,
  resolveFeatureMap,
  type ResolveWarning,
} from "@/core/customizations/resolve";
import { emitStructuredLog, hashClinicScope } from "@/core/observability/structured-log";
import { asStagingSchemaClient } from "@/core/products/staging-schema-client";
import { createClient } from "@/core/supabase/server";

export const FEATURE_DISABLED = "FEATURE_DISABLED" as const;

function logSanitized(
  event: string,
  clinicId: string,
  metadata?: Record<string, unknown>,
  errorCode?: string
) {
  emitStructuredLog({
    level: "warn",
    event: `customizations.${event}`,
    operation: "feature_customizations",
    clinic_scope_hash: hashClinicScope(clinicId),
    status: "degraded",
    error_code: errorCode?.slice(0, 80) ?? null,
    metadata,
  });
}

function logWarnings(clinicId: string, warnings: ResolveWarning[]) {
  for (const w of warnings) {
    logSanitized("invalid_config_ignored", clinicId, {
      feature: w.featureKey,
      layer: w.layer,
      paths: w.paths,
    });
  }
}

/**
 * One RPC per request (React `cache`), keyed by the server-validated active clinic.
 * The user layer is resolved in SQL from `auth.uid()`, never from client input.
 * Any failure (tables missing, RPC error, network) returns code defaults = current behavior.
 */
export const loadFeatureCustomizations = cache(
  async (clinicId: string | null): Promise<FeatureCustomizationsSnapshot> => {
    if (!clinicId) return defaultCustomizationsSnapshot(null);
    try {
      const supabase = asStagingSchemaClient(await createClient());
      const { data, error } = await supabase.rpc("get_feature_settings_snapshot", {
        p_clinic_id: clinicId,
      });
      if (error) {
        logSanitized("snapshot_unavailable", clinicId, undefined, error.message);
        return defaultCustomizationsSnapshot(clinicId, true);
      }
      const warnings: ResolveWarning[] = [];
      const features = resolveFeatureMap(data as FeatureSettingsPayload | null, warnings);
      if (warnings.length > 0) logWarnings(clinicId, warnings);
      return { clinicId, features, degraded: false };
    } catch {
      logSanitized("snapshot_failed", clinicId);
      return defaultCustomizationsSnapshot(clinicId, true);
    }
  }
);

export async function isFeatureEnabled(clinicId: string | null, key: string): Promise<boolean> {
  if (!isFeatureKey(key)) return false;
  const snapshot = await loadFeatureCustomizations(clinicId);
  return isFeatureEnabledInMap(snapshot.features, key);
}

export async function getFeatureConfig(
  clinicId: string | null,
  key: string
): Promise<Record<string, unknown> | null> {
  if (!isFeatureKey(key)) return null;
  const snapshot = await loadFeatureCustomizations(clinicId);
  return getFeatureConfigFromMap(snapshot.features, key);
}

export type FeatureAccessResult =
  | { ok: true }
  | { ok: false; error: typeof FEATURE_DISABLED; feature: string };

/** For server actions / route handlers. `clinicId` must come from a server-validated source. */
export async function checkFeatureAccess(
  clinicId: string | null,
  key: FeatureKey
): Promise<FeatureAccessResult> {
  if (await isFeatureEnabled(clinicId, key)) return { ok: true };
  return { ok: false, error: FEATURE_DISABLED, feature: key };
}

export function featureDisabledResponse(key: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: FEATURE_DISABLED, feature: key, ...extra }, { status: 403 });
}

/** RSC page guard: redirects when the feature is disabled for this clinic/user. */
export async function requireFeaturePage(
  clinicId: string | null,
  key: FeatureKey,
  redirectTo = "/dashboard"
): Promise<void> {
  if (await isFeatureEnabled(clinicId, key)) return;
  try {
    await logAudit({
      clinicId: clinicId ?? undefined,
      entityType: "route_access",
      action: "view",
      metadata: { feature: key, reason: "feature_disabled" },
    });
  } catch {
    // Audit failures must not unblock or crash the redirect.
  }
  redirect(redirectTo);
}

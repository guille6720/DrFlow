import "server-only";

import { cache } from "react";

import { getActiveClinicId } from "@/core/auth/session.server";
import {
  ADDON_SUSPENDED_MESSAGE,
  isSuspendedCommercialStatus,
} from "@/core/entitlements/commercial-status";
import { isFeatureEnforced } from "@/core/entitlements/enforcement";
import {
  parseEntitlementsPayload,
  parseEntitlementUsagePayload,
} from "@/core/entitlements/entitlements-payload";
import type { FeatureKey } from "@/core/entitlements/features";
import {
  canUseFeatureWithCommercialStatus,
  canUseResolvedEntitlement,
  emptyEntitlements,
  getResolvedFeatureLimit,
  lookupFeature,
} from "@/core/entitlements/resolve";
import { resolveTrustedClinicId } from "@/core/entitlements/trusted-clinic";
import {
  type FeatureLimit,
  FeatureRequiredError,
  type ResolvedClinicEntitlements,
} from "@/core/entitlements/types";
import { logServerError } from "@/core/errors/log-error.server";
import { isUndefinedFunction } from "@/core/errors/postgres-error";
import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";
import { createClient } from "@/core/supabase/server";

type FeatureLookupArgs = {
  organizationId?: string | null;
  clinicId?: string | null;
  featureKey: FeatureKey;
};

function requestedClinicId(args: { organizationId?: string | null; clinicId?: string | null }): string | null {
  return args.clinicId ?? args.organizationId ?? null;
}

async function loadUsageFailOpen(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string
): Promise<Pick<ResolvedClinicEntitlements, "usage" | "usagePeriodStart">> {
  const { data, error } = await supabase.rpc("get_clinic_entitlement_usage", {
    p_clinic_id: clinicId,
  });
  if (error) {
    if (!isUndefinedFunction(error)) {
      logServerError("entitlements.usage", error, { clinicId, persist: false });
    }
    return { usage: {}, usagePeriodStart: null };
  }
  const parsed = parseEntitlementUsagePayload(data);
  return { usage: parsed.usage, usagePeriodStart: parsed.periodStart };
}

export const loadEntitlementsForClinic = cache(
  async (clinicId: string): Promise<ResolvedClinicEntitlements> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_clinic_entitlements", {
      p_clinic_id: clinicId,
    });

    if (error) {
      logServerError("entitlements.load", error, { clinicId, persist: false });
      return emptyEntitlements(clinicId);
    }

    const entitlements = parseEntitlementsPayload(data, clinicId);
    if (!entitlements.catalogAvailable) return entitlements;

    const usage = await loadUsageFailOpen(supabase, clinicId);
    return { ...entitlements, ...usage };
  }
);

async function entitlementsForTrustedClinic(
  requestedId?: string | null
): Promise<ResolvedClinicEntitlements> {
  const sessionClinicId = await getActiveClinicId();
  const clinicId = resolveTrustedClinicId(sessionClinicId, requestedId ?? undefined);
  if (!clinicId) return emptyEntitlements(sessionClinicId ?? null);
  return loadEntitlementsForClinic(clinicId);
}

/** NexClinic tenant = clinic. Spec alias: organization. */
export async function getOrganizationEntitlements(args?: {
  organizationId?: string | null;
  clinicId?: string | null;
}): Promise<ResolvedClinicEntitlements> {
  return entitlementsForTrustedClinic(requestedClinicId(args ?? {}));
}

export const getClinicEntitlements = getOrganizationEntitlements;

export async function canUseFeature(args: FeatureLookupArgs): Promise<boolean> {
  const entitlements = await entitlementsForTrustedClinic(requestedClinicId(args));
  return canUseResolvedEntitlement(lookupFeature(entitlements, args.featureKey));
}

/** Session check with fail-open when enforcement is off or the catalog is missing. */
export async function canUseEnforcedFeature(featureKey: FeatureKey): Promise<boolean> {
  const entitlements = await entitlementsForTrustedClinic(null);
  return canUseFeatureWithCommercialStatus(entitlements, featureKey);
}

export async function getFeatureLimit(args: FeatureLookupArgs): Promise<FeatureLimit> {
  const entitlements = await entitlementsForTrustedClinic(requestedClinicId(args));
  return getResolvedFeatureLimit(lookupFeature(entitlements, args.featureKey));
}

export async function requireFeature(args: FeatureLookupArgs): Promise<void> {
  if (!isFeatureEnforced(args.featureKey)) return;
  const entitlements = await entitlementsForTrustedClinic(requestedClinicId(args));
  if (!canUseFeatureWithCommercialStatus(entitlements, args.featureKey)) {
    throw new FeatureRequiredError(args.featureKey);
  }
}

export async function requireAddonFeatureAccess(
  featureKey: FeatureKey
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireFeature({ featureKey });
    return { ok: true };
  } catch (error) {
    if (error instanceof FeatureRequiredError) {
      const entitlements = await entitlementsForTrustedClinic(null);
      const resolved = lookupFeature(entitlements, featureKey);
      if (
        entitlements.catalogAvailable &&
        isSuspendedCommercialStatus(entitlements.status, entitlements.trialEndsAt) &&
        resolved?.source !== "override"
      ) {
        return { ok: false, error: ADDON_SUSPENDED_MESSAGE };
      }
      return { ok: false, error: "Esta función no está incluida en el plan del consultorio." };
    }
    throw error;
  }
}

/** Jobs / API keys. Missing catalog or admin client fails open. */
export async function canUseFeatureAsSystem(args: {
  clinicId: string;
  featureKey: FeatureKey;
}): Promise<boolean> {
  if (!isFeatureEnforced(args.featureKey)) return true;
  if (!args.clinicId) return true;
  if (!hasAdminClient()) return true;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_clinic_entitlements", {
    p_clinic_id: args.clinicId,
  });
  if (error) return true;

  const entitlements = parseEntitlementsPayload(data, args.clinicId);
  return canUseFeatureWithCommercialStatus(entitlements, args.featureKey);
}

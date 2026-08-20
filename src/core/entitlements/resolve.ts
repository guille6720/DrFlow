import {
  effectiveCommercialStatus,
  isSuspendedCommercialStatus,
} from "@/core/entitlements/commercial-status";
import { isFeatureEnforced } from "@/core/entitlements/enforcement";
import type { FeatureKey } from "@/core/entitlements/features";
import type {
  ClientEntitlementsSnapshot,
  EntitlementSource,
  EntitlementSubscriptionStatus,
  FeatureCatalogRow,
  FeatureLimit,
  FeatureOverrideRow,
  FeatureType,
  PlanFeatureRow,
  ResolvedClinicEntitlements,
  ResolvedFeatureEntitlement,
} from "@/core/entitlements/types";

function asDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

export function isOverrideActive(
  override: FeatureOverrideRow | null | undefined,
  now: Date = new Date()
): boolean {
  if (!override) return false;
  const startsAt = asDate(override.startsAt);
  const endsAt = asDate(override.endsAt);
  if (startsAt && startsAt.getTime() > now.getTime()) return false;
  if (endsAt && endsAt.getTime() <= now.getTime()) return false;
  return true;
}

export function parseLimitValue(
  featureType: FeatureType,
  enabled: boolean,
  value: unknown
): FeatureLimit {
  if (featureType === "boolean") return enabled ? null : 0;
  if (!enabled) return 0;
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function defaultEnabled(feature: FeatureCatalogRow): boolean {
  if (feature.featureType === "boolean") return feature.defaultValue === true;
  if (feature.defaultValue === null || feature.defaultValue === undefined) return false;
  if (feature.defaultValue === 0) return false;
  return true;
}

export function resolveFeatureEntitlement(input: {
  feature: FeatureCatalogRow | null;
  planFeature?: PlanFeatureRow | null;
  override?: FeatureOverrideRow | null;
  now?: Date;
}): ResolvedFeatureEntitlement {
  const deny: ResolvedFeatureEntitlement = {
    enabled: false,
    limit: 0,
    source: "deny",
    featureType: input.feature?.featureType ?? "boolean",
  };

  if (!input.feature || !input.feature.isActive) return deny;

  const now = input.now ?? new Date();
  let enabled: boolean;
  let value: unknown;
  let source: EntitlementSource;

  if (isOverrideActive(input.override, now) && input.override) {
    enabled = input.override.enabled;
    value = input.override.value;
    source = "override";
  } else if (input.planFeature) {
    enabled = input.planFeature.enabled;
    value = input.planFeature.value;
    source = "plan";
  } else {
    enabled = defaultEnabled(input.feature);
    value = input.feature.defaultValue;
    source = "default";
  }

  return {
    enabled,
    limit: parseLimitValue(input.feature.featureType, enabled, value),
    source,
    featureType: input.feature.featureType,
  };
}

export function canUseResolvedEntitlement(resolved: ResolvedFeatureEntitlement | undefined): boolean {
  if (!resolved || resolved.source === "deny") return false;
  if (!resolved.enabled) return false;
  if (resolved.featureType === "limit" && resolved.limit === 0) return false;
  return true;
}

export function getResolvedFeatureLimit(
  resolved: ResolvedFeatureEntitlement | undefined
): FeatureLimit {
  if (!resolved || resolved.source === "deny") return 0;
  return resolved.limit;
}

export function emptyEntitlements(clinicId: string | null = null): ResolvedClinicEntitlements {
  return {
    clinicId,
    planKey: null,
    planId: null,
    status: null,
    trialEndsAt: null,
    catalogAvailable: false,
    features: {},
    usage: {},
    usagePeriodStart: null,
  };
}

export function toClientEntitlementsSnapshot(
  entitlements: ResolvedClinicEntitlements
): ClientEntitlementsSnapshot {
  const allowed: ClientEntitlementsSnapshot["allowed"] = {};
  const limits: ClientEntitlementsSnapshot["limits"] = {};
  for (const [key, value] of Object.entries(entitlements.features)) {
    if (!value) continue;
    const featureKey = key as FeatureKey;
    allowed[featureKey] = canUseFeatureWithCommercialStatus(entitlements, featureKey);
    if (value.featureType === "limit") limits[featureKey] = value.limit;
  }
  return {
    catalogAvailable: entitlements.catalogAvailable,
    planKey: entitlements.planKey,
    status: effectiveCommercialStatus(entitlements.status, entitlements.trialEndsAt) as
      | EntitlementSubscriptionStatus
      | null,
    allowed,
    usage: entitlements.usage ?? {},
    limits,
  };
}

export function lookupFeature(
  entitlements: ResolvedClinicEntitlements,
  featureKey: FeatureKey
): ResolvedFeatureEntitlement | undefined {
  return entitlements.features[featureKey];
}

/** Catalog fail-open. Suspension pauses plan add-ons; an active override still wins. */
export function canUseFeatureWithCommercialStatus(
  entitlements: ResolvedClinicEntitlements,
  featureKey: FeatureKey
): boolean {
  if (!isFeatureEnforced(featureKey)) return true;
  if (!entitlements.catalogAvailable) return true;
  const resolved = lookupFeature(entitlements, featureKey);
  if (isSuspendedCommercialStatus(entitlements.status, entitlements.trialEndsAt)) {
    return resolved?.source === "override" && canUseResolvedEntitlement(resolved);
  }
  return canUseResolvedEntitlement(resolved);
}

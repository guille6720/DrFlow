import type { FeatureKey } from "@/core/entitlements/features";
import type { PlanKey } from "@/core/entitlements/plan-keys";

export type FeatureType = "boolean" | "limit";

export type EntitlementSource = "override" | "plan" | "default" | "deny";

export type EntitlementSubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

/** null = unlimited; 0 = unavailable; positive = maximum allowed. */
export type FeatureLimit = number | null;

export type ResolvedFeatureEntitlement = {
  enabled: boolean;
  limit: FeatureLimit;
  source: EntitlementSource;
  featureType: FeatureType;
};

export type ResolvedClinicEntitlements = {
  clinicId: string | null;
  planKey: PlanKey | string | null;
  planId: string | null;
  status: EntitlementSubscriptionStatus | null;
  trialEndsAt: string | null;
  catalogAvailable: boolean;
  features: Partial<Record<FeatureKey, ResolvedFeatureEntitlement>>;
  usage: Partial<Record<FeatureKey, number>>;
  usagePeriodStart: string | null;
};

export type ClientEntitlementsSnapshot = {
  catalogAvailable: boolean;
  planKey: string | null;
  status: EntitlementSubscriptionStatus | null;
  allowed: Partial<Record<FeatureKey, boolean>>;
  usage: Partial<Record<FeatureKey, number>>;
  limits: Partial<Record<FeatureKey, FeatureLimit>>;
};

export type PlanFeatureRow = {
  enabled: boolean;
  value: unknown;
};

export type FeatureOverrideRow = {
  enabled: boolean;
  value: unknown;
  startsAt: string | Date | null;
  endsAt: string | Date | null;
};

export type FeatureCatalogRow = {
  key: FeatureKey | string;
  featureType: FeatureType;
  defaultValue: unknown;
  usageMetered: boolean;
  isActive: boolean;
};

export type UsageIncrementResult =
  | { ok: true; amount: number; periodStart: string }
  | { ok: false; error: string };

export class FeatureRequiredError extends Error {
  readonly featureKey: FeatureKey;

  constructor(featureKey: FeatureKey) {
    super(`FEATURE_REQUIRED:${featureKey}`);
    this.name = "FeatureRequiredError";
    this.featureKey = featureKey;
  }
}

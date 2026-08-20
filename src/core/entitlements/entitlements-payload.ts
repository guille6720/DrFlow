import { z } from "zod";

import { type FeatureKey, isFeatureKey } from "@/core/entitlements/features";
import { emptyEntitlements } from "@/core/entitlements/resolve";
import type { ResolvedClinicEntitlements, ResolvedFeatureEntitlement } from "@/core/entitlements/types";

const resolvedFeatureSchema = z.object({
  enabled: z.boolean(),
  limit: z.number().nullable(),
  source: z.enum(["override", "plan", "default", "deny"]),
  feature_type: z.enum(["boolean", "limit"]),
});

const entitlementsPayloadSchema = z.object({
  clinic_id: z.string().uuid().nullable().optional(),
  plan_key: z.string().nullable().optional(),
  plan_id: z.string().uuid().nullable().optional(),
  status: z
    .enum(["trialing", "active", "past_due", "cancelled", "expired"])
    .nullable()
    .optional(),
  trial_ends_at: z.string().nullable().optional(),
  features: z.record(z.string(), resolvedFeatureSchema),
});

function mapResolvedFeature(row: z.infer<typeof resolvedFeatureSchema>): ResolvedFeatureEntitlement {
  return {
    enabled: row.enabled,
    limit: row.limit,
    source: row.source,
    featureType: row.feature_type,
  };
}

export function parseEntitlementsPayload(
  payload: unknown,
  clinicId: string
): ResolvedClinicEntitlements {
  const parsed = entitlementsPayloadSchema.safeParse(payload);
  if (!parsed.success) return emptyEntitlements(clinicId);

  const features: ResolvedClinicEntitlements["features"] = {};
  for (const [key, value] of Object.entries(parsed.data.features)) {
    if (!isFeatureKey(key)) continue;
    features[key] = mapResolvedFeature(value);
  }

  return {
    clinicId: parsed.data.clinic_id ?? clinicId,
    planKey: parsed.data.plan_key ?? null,
    planId: parsed.data.plan_id ?? null,
    status: parsed.data.status ?? null,
    trialEndsAt: parsed.data.trial_ends_at ?? null,
    catalogAvailable: true,
    features,
    usage: {},
    usagePeriodStart: null,
  };
}

export function parseEntitlementUsagePayload(payload: unknown): {
  usage: Partial<Record<FeatureKey, number>>;
  periodStart: string | null;
} {
  const parsed = z
    .object({
      period_start: z.union([z.string(), z.null()]).optional(),
      usage: z.record(z.string(), z.coerce.number()),
    })
    .safeParse(payload);

  if (!parsed.success) return { usage: {}, periodStart: null };

  const usage: Partial<Record<FeatureKey, number>> = {};
  for (const [key, amount] of Object.entries(parsed.data.usage)) {
    if (!isFeatureKey(key)) continue;
    usage[key] = amount;
  }
  return {
    usage,
    periodStart: parsed.data.period_start ? String(parsed.data.period_start) : null,
  };
}

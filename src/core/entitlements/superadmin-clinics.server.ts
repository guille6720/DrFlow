import "server-only";

import {
  effectiveCommercialStatus,
  pickCurrentEntitlementSubscription,
} from "@/core/entitlements/commercial-status";
import { type FeatureKey, FEATURES, isFeatureKey } from "@/core/entitlements/features";
import type { RecommendationSeverity } from "@/core/entitlements/plan-recommendation";
import { getPlanRecommendation } from "@/core/entitlements/plan-recommendation";
import { isOverrideActive } from "@/core/entitlements/resolve";
import { requireSuperadminOrDeny } from "@/core/entitlements/superadmin-guard.server";
import { untypedDb } from "@/core/entitlements/untyped-db.server";
import { featureUsagePeriodStart } from "@/core/entitlements/usage-period";
import {
  DEFAULT_USAGE_THRESHOLDS,
  type UsageThresholds,
} from "@/core/entitlements/usage-thresholds";
import { logServerError } from "@/core/errors/log-error.server";
import { createClient } from "@/core/supabase/server";

export type SuperadminClinicCommercialRow = {
  clinicId: string;
  clinicName: string;
  ownerName: string | null;
  ownerEmail: string | null;
  planKey: string | null;
  status: string | null;
  trialEndsAt: string | null;
  startsAt: string | null;
  users: number;
  professionals: number;
  patients: number;
  usageAi: number;
  usageWhatsapp: number;
  limitPatients: number | null;
  recommendedPlan: string | null;
  recommendationSeverity: RecommendationSeverity | null;
  recommendationReasons: string[];
  shouldRecommendUpgrade: boolean;
  /** Mercado Pago billing SKU if present. */
  billingPlanId: string | null;
  promoPriceArs: number | null;
  regularPriceArs: number | null;
  promoEndsAt: string | null;
};

export type SuperadminDashboardStats = {
  totalClinics: number;
  byPlan: Record<string, number>;
  activeSubscriptions: number;
  expiredTrials: number;
  suspended: number;
  upgradeRecommendations: number;
  nearLimit: number;
  atLimit: number;
};

function asPlanKey(plans: unknown): string | null {
  if (!plans) return null;
  if (Array.isArray(plans)) return (plans[0] as { key?: string } | undefined)?.key ?? null;
  return (plans as { key?: string }).key ?? null;
}

export async function loadUsageThresholds(): Promise<UsageThresholds> {
  const access = await requireSuperadminOrDeny();
  if (!access.ok) return DEFAULT_USAGE_THRESHOLDS;
  const supabase = await createClient();
  const { data, error } = await untypedDb(supabase)
    .from("commercial_usage_thresholds")
    .select("info_pct, warn_pct, critical_pct")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) {
    return DEFAULT_USAGE_THRESHOLDS;
  }
  return {
    infoPct: Number(data.info_pct) || DEFAULT_USAGE_THRESHOLDS.infoPct,
    warnPct: Number(data.warn_pct) || DEFAULT_USAGE_THRESHOLDS.warnPct,
    criticalPct: Number(data.critical_pct) || DEFAULT_USAGE_THRESHOLDS.criticalPct,
  };
}

/** Batched commercial clinic list — no per-clinic entitlement RPC. */
export async function listSuperadminClinicCommercialRows(): Promise<
  SuperadminClinicCommercialRow[]
> {
  const access = await requireSuperadminOrDeny();
  if (!access.ok) return [];

  const supabase = await createClient();
  const thresholds = await loadUsageThresholds();

  const { data: clinics, error } = await supabase
    .from("clinics")
    .select("id, name")
    .order("name")
    .limit(2000);
  if (error || !clinics) {
    logServerError("superadmin.clinics", error, { persist: false });
    return [];
  }

  const clinicIds = clinics.map((c) => c.id);

  const [
    { data: subs },
    { data: members },
    { data: professionals },
    { data: patientCounts },
    { data: usageRows },
    { data: planFeatures },
    { data: overrides },
    { data: admins },
    { data: billingSubs },
  ] = await Promise.all([
    supabase
      .from("clinic_entitlement_subscriptions")
      .select("clinic_id, status, created_at, starts_at, trial_ends_at, plans(key)")
      .order("created_at", { ascending: false }),
    supabase
      .from("clinic_members")
      .select("clinic_id")
      .eq("is_active", true)
      .in("clinic_id", clinicIds),
    supabase.from("professionals").select("clinic_id").in("clinic_id", clinicIds),
    supabase.from("patients").select("clinic_id").in("clinic_id", clinicIds),
    supabase
      .from("feature_usage")
      .select("clinic_id, amount, features!inner(key)")
      .eq("period_start", featureUsagePeriodStart())
      .in("clinic_id", clinicIds),
    supabase.from("plan_features").select("enabled, value, plans!inner(key), features!inner(key)"),
    supabase
      .from("clinic_feature_overrides")
      .select("clinic_id, enabled, value, starts_at, ends_at, features!inner(key)")
      .in("clinic_id", clinicIds),
    supabase
      .from("clinic_members")
      .select("clinic_id, role, profiles(full_name, email)")
      .eq("is_active", true)
      .eq("role", "clinic_admin")
      .in("clinic_id", clinicIds),
    untypedDb(supabase)
      .from("clinic_subscriptions")
      .select("clinic_id, plan_id, promo_price_amount, regular_price_amount, promo_ends_at")
      .in("clinic_id", clinicIds),
  ]);

  const billingByClinic = new Map<
    string,
    {
      planId: string | null;
      promoPriceArs: number | null;
      regularPriceArs: number | null;
      promoEndsAt: string | null;
    }
  >();
  for (const row of billingSubs ?? []) {
    const typed = row as {
      clinic_id: string;
      plan_id: string | null;
      promo_price_amount: number | null;
      regular_price_amount: number | null;
      promo_ends_at: string | null;
    };
    billingByClinic.set(typed.clinic_id, {
      planId: typed.plan_id,
      promoPriceArs: typed.promo_price_amount,
      regularPriceArs: typed.regular_price_amount,
      promoEndsAt: typed.promo_ends_at,
    });
  }

  const planFeatureMap = new Map<string, Map<string, { enabled: boolean; value: number | null }>>();
  for (const row of planFeatures ?? []) {
    const typed = row as {
      enabled: boolean;
      value: unknown;
      plans: { key: string } | { key: string }[] | null;
      features: { key: string } | { key: string }[] | null;
    };
    const planKey = asPlanKey(typed.plans);
    const feature = Array.isArray(typed.features) ? typed.features[0] : typed.features;
    if (!planKey || !feature?.key) continue;
    const map = planFeatureMap.get(planKey) ?? new Map();
    const value =
      typed.value === null || typed.value === undefined
        ? null
        : typeof typed.value === "number"
          ? typed.value
          : Number(typed.value);
    map.set(feature.key, {
      enabled: typed.enabled,
      value: Number.isFinite(value as number) ? (value as number) : null,
    });
    planFeatureMap.set(planKey, map);
  }

  const subsByClinic = new Map<
    string,
    Array<{
      status: string;
      createdAt: string;
      startsAt: string | null;
      trialEndsAt: string | null;
      planKey: string | null;
    }>
  >();
  for (const row of subs ?? []) {
    const typed = row as {
      clinic_id: string;
      status: string;
      created_at: string;
      starts_at: string | null;
      trial_ends_at: string | null;
      plans: { key: string } | { key: string }[] | null;
    };
    const list = subsByClinic.get(typed.clinic_id) ?? [];
    list.push({
      status: typed.status,
      createdAt: typed.created_at,
      startsAt: typed.starts_at,
      trialEndsAt: typed.trial_ends_at,
      planKey: asPlanKey(typed.plans),
    });
    subsByClinic.set(typed.clinic_id, list);
  }

  const countMap = (rows: { clinic_id: string }[] | null) => {
    const map = new Map<string, number>();
    for (const row of rows ?? []) {
      map.set(row.clinic_id, (map.get(row.clinic_id) ?? 0) + 1);
    }
    return map;
  };
  const usersByClinic = countMap(members as { clinic_id: string }[] | null);
  const prosByClinic = countMap(professionals as { clinic_id: string }[] | null);
  const patientsByClinic = countMap(patientCounts as { clinic_id: string }[] | null);

  const usageByClinic = new Map<string, { ai: number; whatsapp: number }>();
  for (const row of usageRows ?? []) {
    const typed = row as {
      clinic_id: string;
      amount: number;
      features: { key: string } | { key: string }[] | null;
    };
    const feature = Array.isArray(typed.features) ? typed.features[0] : typed.features;
    const bucket = usageByClinic.get(typed.clinic_id) ?? { ai: 0, whatsapp: 0 };
    if (feature?.key === FEATURES.AI_MONTHLY_REQUESTS) bucket.ai = Number(typed.amount) || 0;
    if (feature?.key === FEATURES.WHATSAPP_MONTHLY_MESSAGES) {
      bucket.whatsapp = Number(typed.amount) || 0;
    }
    usageByClinic.set(typed.clinic_id, bucket);
  }

  const overridesByClinic = new Map<
    string,
    Array<{ key: string; enabled: boolean; value: unknown; startsAt: string | null; endsAt: string | null }>
  >();
  for (const row of overrides ?? []) {
    const typed = row as {
      clinic_id: string;
      enabled: boolean;
      value: unknown;
      starts_at: string | null;
      ends_at: string | null;
      features: { key: string } | { key: string }[] | null;
    };
    const feature = Array.isArray(typed.features) ? typed.features[0] : typed.features;
    if (!feature?.key) continue;
    const list = overridesByClinic.get(typed.clinic_id) ?? [];
    list.push({
      key: feature.key,
      enabled: typed.enabled,
      value: typed.value,
      startsAt: typed.starts_at,
      endsAt: typed.ends_at,
    });
    overridesByClinic.set(typed.clinic_id, list);
  }

  const ownerByClinic = new Map<string, { name: string | null; email: string | null }>();
  for (const row of admins ?? []) {
    const typed = row as {
      clinic_id: string;
      profiles: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null;
    };
    if (ownerByClinic.has(typed.clinic_id)) continue;
    const profile = Array.isArray(typed.profiles) ? typed.profiles[0] : typed.profiles;
    ownerByClinic.set(typed.clinic_id, {
      name: profile?.full_name ?? null,
      email: profile?.email ?? null,
    });
  }

  return clinics.flatMap((clinic) => {
    try {
      const current = pickCurrentEntitlementSubscription(subsByClinic.get(clinic.id) ?? []);
      const planKey = current?.planKey ?? null;
      const status = current
        ? effectiveCommercialStatus(current.status, current.trialEndsAt)
        : null;
      const planMap = planKey ? planFeatureMap.get(planKey) : undefined;
      const enabledFeatures: Partial<Record<FeatureKey, boolean>> = {};
      const limits: Partial<Record<FeatureKey, number | null>> = {};
      const overrideGranted: Partial<Record<FeatureKey, boolean>> = {};

      if (planMap) {
        for (const [key, val] of planMap) {
          if (!isFeatureKey(key)) continue;
          enabledFeatures[key] = val.enabled;
          limits[key] = val.value;
        }
      }

      for (const ov of overridesByClinic.get(clinic.id) ?? []) {
        if (
          !isOverrideActive({
            enabled: ov.enabled,
            value: ov.value,
            startsAt: ov.startsAt,
            endsAt: ov.endsAt,
          })
        ) {
          continue;
        }
        if (!isFeatureKey(ov.key)) continue;
        enabledFeatures[ov.key] = ov.enabled;
        if (ov.enabled && planMap?.get(ov.key)?.enabled !== true) {
          overrideGranted[ov.key] = true;
        }
        if (typeof ov.value === "number") limits[ov.key] = ov.value;
      }

      const usage = usageByClinic.get(clinic.id) ?? { ai: 0, whatsapp: 0 };
      const users = usersByClinic.get(clinic.id) ?? 0;
      const professionals = prosByClinic.get(clinic.id) ?? 0;
      const patients = patientsByClinic.get(clinic.id) ?? 0;

      const recommendation = getPlanRecommendation({
        currentPlanKey: planKey,
        status,
        enabledFeatures,
        overrideGrantedFeatures: overrideGranted,
        usage: {
          [FEATURES.AI_MONTHLY_REQUESTS]: usage.ai,
          [FEATURES.WHATSAPP_MONTHLY_MESSAGES]: usage.whatsapp,
          [FEATURES.PATIENTS_MAX]: patients,
          [FEATURES.USERS_MAX]: users,
          [FEATURES.PROFESSIONALS_MAX]: professionals,
        },
        limits: {
          [FEATURES.AI_MONTHLY_REQUESTS]: limits[FEATURES.AI_MONTHLY_REQUESTS] ?? null,
          [FEATURES.WHATSAPP_MONTHLY_MESSAGES]: limits[FEATURES.WHATSAPP_MONTHLY_MESSAGES] ?? null,
          [FEATURES.PATIENTS_MAX]: limits[FEATURES.PATIENTS_MAX] ?? null,
          [FEATURES.USERS_MAX]: limits[FEATURES.USERS_MAX] ?? null,
          [FEATURES.PROFESSIONALS_MAX]: limits[FEATURES.PROFESSIONALS_MAX] ?? null,
        },
        counts: { users, professionals, patients },
        thresholds,
      });

      const billing = billingByClinic.get(clinic.id);
      return [
        {
          clinicId: clinic.id,
          clinicName: clinic.name,
          ownerName: ownerByClinic.get(clinic.id)?.name ?? null,
          ownerEmail: ownerByClinic.get(clinic.id)?.email ?? null,
          planKey,
          status,
          trialEndsAt: current?.trialEndsAt ?? null,
          startsAt: current?.startsAt ?? null,
          users,
          professionals,
          patients,
          usageAi: usage.ai,
          usageWhatsapp: usage.whatsapp,
          limitPatients: limits[FEATURES.PATIENTS_MAX] ?? null,
          recommendedPlan: recommendation.recommendedPlan,
          recommendationSeverity: recommendation.severity,
          recommendationReasons: recommendation.reasons ?? [],
          shouldRecommendUpgrade: recommendation.shouldRecommendUpgrade,
          billingPlanId: billing?.planId ?? null,
          promoPriceArs: billing?.promoPriceArs ?? null,
          regularPriceArs: billing?.regularPriceArs ?? null,
          promoEndsAt: billing?.promoEndsAt ?? null,
        } satisfies SuperadminClinicCommercialRow,
      ];
    } catch (err) {
      logServerError("superadmin.clinics.row", err, { persist: false });
      return [
        {
          clinicId: clinic.id,
          clinicName: clinic.name,
          ownerName: null,
          ownerEmail: null,
          planKey: null,
          status: null,
          trialEndsAt: null,
          startsAt: null,
          users: 0,
          professionals: 0,
          patients: 0,
          usageAi: 0,
          usageWhatsapp: 0,
          limitPatients: null,
          recommendedPlan: null,
          recommendationSeverity: "info" as RecommendationSeverity,
          recommendationReasons: ["Error al calcular recomendación"],
          shouldRecommendUpgrade: false,
          billingPlanId: null,
          promoPriceArs: null,
          regularPriceArs: null,
          promoEndsAt: null,
        } satisfies SuperadminClinicCommercialRow,
      ];
    }
  });
}

export async function getSuperadminDashboardStats(): Promise<SuperadminDashboardStats> {
  const rows = await listSuperadminClinicCommercialRows();
  const byPlan: Record<string, number> = {};
  let activeSubscriptions = 0;
  let expiredTrials = 0;
  let suspended = 0;
  let upgradeRecommendations = 0;
  let nearLimit = 0;
  let atLimit = 0;

  for (const row of rows) {
    const key = row.planKey ?? "none";
    byPlan[key] = (byPlan[key] ?? 0) + 1;
    if (row.status === "active" || row.status === "trialing") activeSubscriptions += 1;
    if (row.status === "expired") expiredTrials += 1;
    if (row.status === "past_due" || row.status === "cancelled" || row.status === "expired") {
      suspended += 1;
    }
    if (row.shouldRecommendUpgrade) upgradeRecommendations += 1;
    if (row.limitPatients != null && row.limitPatients > 0) {
      const pct = (row.patients / row.limitPatients) * 100;
      if (pct >= 100) atLimit += 1;
      else if (pct >= 85) nearLimit += 1;
    }
  }

  return {
    totalClinics: rows.length,
    byPlan,
    activeSubscriptions,
    expiredTrials,
    suspended,
    upgradeRecommendations,
    nearLimit,
    atLimit,
  };
}

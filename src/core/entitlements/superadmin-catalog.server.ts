import "server-only";

import { diffPlanFeatures, type PlanDiff } from "@/core/entitlements/plan-diff";
import { requireSuperadminOrDeny } from "@/core/entitlements/superadmin-guard.server";
import { logServerError } from "@/core/errors/log-error.server";
import { createClient } from "@/core/supabase/server";

export type SuperadminPlanRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isInternal: boolean;
  isPublic: boolean;
  displayOrder: number;
  metadata: Record<string, unknown>;
};

export type SuperadminFeatureRow = {
  id: string;
  key: string;
  name: string;
  featureType: string;
  usageMetered: boolean;
  isActive: boolean;
  defaultValue: unknown;
  planKeys: string[];
};

export async function listSuperadminPlans(): Promise<SuperadminPlanRow[]> {
  const access = await requireSuperadminOrDeny();
  if (!access.ok) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("id, key, name, description, is_active, is_internal, is_public, display_order, metadata")
    .order("display_order");
  if (error) {
    logServerError("superadmin.plans", error, { persist: false });
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    isInternal: row.is_internal,
    isPublic: row.is_public,
    displayOrder: row.display_order,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
  }));
}

export async function listSuperadminFeatures(): Promise<SuperadminFeatureRow[]> {
  const access = await requireSuperadminOrDeny();
  if (!access.ok) return [];
  const supabase = await createClient();
  const [{ data: features, error }, { data: planFeatures }] = await Promise.all([
    supabase
      .from("features")
      .select("id, key, name, feature_type, usage_metered, is_active, default_value")
      .order("key"),
    supabase.from("plan_features").select("enabled, plans!inner(key), features!inner(key)"),
  ]);
  if (error) {
    logServerError("superadmin.features", error, { persist: false });
    return [];
  }
  const plansByFeature = new Map<string, string[]>();
  for (const row of planFeatures ?? []) {
    const typed = row as {
      enabled: boolean;
      plans: { key: string } | { key: string }[] | null;
      features: { key: string } | { key: string }[] | null;
    };
    if (!typed.enabled) continue;
    const plan = Array.isArray(typed.plans) ? typed.plans[0] : typed.plans;
    const feature = Array.isArray(typed.features) ? typed.features[0] : typed.features;
    if (!plan?.key || !feature?.key) continue;
    const list = plansByFeature.get(feature.key) ?? [];
    list.push(plan.key);
    plansByFeature.set(feature.key, list);
  }
  return (features ?? []).map((row) => ({
    id: row.id,
    key: row.key,
    name: row.name,
    featureType: row.feature_type,
    usageMetered: row.usage_metered,
    isActive: row.is_active,
    defaultValue: row.default_value,
    planKeys: plansByFeature.get(row.key) ?? [],
  }));
}

export async function compareClinicPlans(
  currentPlanKey: string,
  newPlanKey: string
): Promise<PlanDiff | null> {
  const access = await requireSuperadminOrDeny();
  if (!access.ok) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_features")
    .select("enabled, value, plans!inner(key), features!inner(key)");
  if (error) {
    logServerError("superadmin.plan-diff", error, { persist: false });
    return null;
  }
  const currentFeatures = [];
  const newFeatures = [];
  for (const row of data ?? []) {
    const typed = row as {
      enabled: boolean;
      value: unknown;
      plans: { key: string } | { key: string }[] | null;
      features: { key: string } | { key: string }[] | null;
    };
    const plan = Array.isArray(typed.plans) ? typed.plans[0] : typed.plans;
    const feature = Array.isArray(typed.features) ? typed.features[0] : typed.features;
    if (!plan?.key || !feature?.key) continue;
    if (plan.key !== currentPlanKey && plan.key !== newPlanKey) continue;
    const value =
      typed.value === null || typed.value === undefined
        ? null
        : typeof typed.value === "number"
          ? typed.value
          : Number(typed.value);
    const snap = {
      key: feature.key,
      enabled: typed.enabled,
      value: Number.isFinite(value as number) ? (value as number) : null,
    };
    if (plan.key === currentPlanKey) currentFeatures.push(snap);
    if (plan.key === newPlanKey) newFeatures.push(snap);
  }
  return diffPlanFeatures(currentPlanKey, newPlanKey, currentFeatures, newFeatures);
}

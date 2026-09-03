import "server-only";

import { z } from "zod";

import { getProfile, getSession } from "@/core/auth/session.server";
import {
  ADMIN_SUBSCRIPTION_STATUS_KEYS,
  type EntitlementsAdminClinicRow,
  type EntitlementsAdminOverrideRow,
} from "@/core/entitlements/admin-constants";
import {
  effectiveCommercialStatus,
  pickCurrentEntitlementSubscription,
} from "@/core/entitlements/commercial-status";
import { FEATURES, isFeatureKey } from "@/core/entitlements/features";
import { PLAN_KEYS } from "@/core/entitlements/plan-keys";
import { isOverrideActive } from "@/core/entitlements/resolve";
import { featureUsagePeriodStart } from "@/core/entitlements/usage-period";
import { logServerError } from "@/core/errors/log-error.server";
import { getRpcCode } from "@/core/errors/postgres-error";
import { recordAudit } from "@/core/security/audit-service";
import { nullToUndefined } from "@/core/supabase/json";
import { createClient } from "@/core/supabase/server";

const planKeySchema = z.enum([
  PLAN_KEYS.TRIAL,
  PLAN_KEYS.ESSENTIAL,
  PLAN_KEYS.BASIC,
  PLAN_KEYS.PRO,
  PLAN_KEYS.PREMIUM,
  PLAN_KEYS.ENTERPRISE,
  PLAN_KEYS.LEGACY,
]);

const statusSchema = z.enum(ADMIN_SUBSCRIPTION_STATUS_KEYS);

async function requireSuperadminSession() {
  const [user, profile] = await Promise.all([getSession(), getProfile()]);
  if (!user || !profile?.is_superadmin) {
    return { ok: false as const, error: "Solo superadmin." };
  }
  return { ok: true as const, userId: user.id };
}

export async function listEntitlementsAdminClinics(): Promise<EntitlementsAdminClinicRow[]> {
  const access = await requireSuperadminSession();
  if (!access.ok) return [];

  const supabase = await createClient();
  const { data: clinics, error } = await supabase
    .from("clinics")
    .select("id, name")
    .order("name")
    .limit(200);

  if (error || !clinics) {
    logServerError("entitlements.admin.list-clinics", error, { persist: false });
    return [];
  }

  const { data: subs } = await supabase
    .from("clinic_entitlement_subscriptions")
    .select("clinic_id, status, created_at, trial_ends_at, plans(key)")
    .order("created_at", { ascending: false });

  const subsByClinic = new Map<
    string,
    Array<{ status: string; createdAt: string; trialEndsAt: string | null; planKey: string | null }>
  >();
  for (const row of subs ?? []) {
    const typed = row as {
      clinic_id: string;
      status: string;
      created_at: string;
      trial_ends_at: string | null;
      plans: { key: string } | { key: string }[] | null;
    };
    const plan = Array.isArray(typed.plans) ? typed.plans[0] : typed.plans;
    const list = subsByClinic.get(typed.clinic_id) ?? [];
    list.push({
      status: typed.status,
      createdAt: typed.created_at,
      trialEndsAt: typed.trial_ends_at,
      planKey: plan?.key ?? null,
    });
    subsByClinic.set(typed.clinic_id, list);
  }

  const planByClinic = new Map<
    string,
    { planKey: string | null; status: string | null; trialEndsAt: string | null }
  >();
  for (const [clinicId, rows] of subsByClinic) {
    const current = pickCurrentEntitlementSubscription(rows);
    planByClinic.set(clinicId, {
      planKey: current?.planKey ?? null,
      status: current
        ? effectiveCommercialStatus(current.status, current.trialEndsAt)
        : null,
      trialEndsAt: current?.trialEndsAt ?? null,
    });
  }

  const clinicIds = clinics.map((clinic) => clinic.id);
  const usageByClinic = new Map<string, { ai: number; whatsapp: number }>();
  const { data: usageRows, error: usageError } = clinicIds.length
    ? await supabase
        .from("feature_usage")
        .select("clinic_id, amount, features!inner(key)")
        .eq("period_start", featureUsagePeriodStart())
        .in("clinic_id", clinicIds)
    : { data: [] as never[], error: null };

  if (usageError) {
    logServerError("entitlements.admin.usage", usageError, { persist: false });
  } else {
    for (const row of usageRows ?? []) {
      const typed = row as {
        clinic_id: string;
        amount: number;
        features: { key: string } | { key: string }[] | null;
      };
      const feature = Array.isArray(typed.features) ? typed.features[0] : typed.features;
      const current = usageByClinic.get(typed.clinic_id) ?? { ai: 0, whatsapp: 0 };
      if (feature?.key === FEATURES.AI_MONTHLY_REQUESTS) current.ai = typed.amount;
      if (feature?.key === FEATURES.WHATSAPP_MONTHLY_MESSAGES) current.whatsapp = typed.amount;
      usageByClinic.set(typed.clinic_id, current);
    }
  }

  return clinics.map((clinic) => {
    const usage = usageError ? null : (usageByClinic.get(clinic.id) ?? { ai: 0, whatsapp: 0 });
    return {
      clinicId: clinic.id,
      clinicName: clinic.name,
      planKey: planByClinic.get(clinic.id)?.planKey ?? null,
      status: planByClinic.get(clinic.id)?.status ?? null,
      trialEndsAt: planByClinic.get(clinic.id)?.trialEndsAt ?? null,
      usageAi: usage?.ai ?? null,
      usageWhatsapp: usage?.whatsapp ?? null,
    };
  });
}

export async function assignClinicEntitlementPlan(input: {
  clinicId: string;
  planKey: string;
  reason?: string;
}): Promise<{ ok: true; planKey: string } | { ok: false; error: string }> {
  const access = await requireSuperadminSession();
  if (!access.ok) return access;

  const planParsed = planKeySchema.safeParse(input.planKey);
  if (!planParsed.success) return { ok: false, error: "Plan inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assign_clinic_entitlement_plan", {
    p_clinic_id: input.clinicId,
    p_plan_key: planParsed.data,
    p_reason: nullToUndefined(input.reason ?? null),
  });

  if (error) {
    logServerError("entitlements.admin.assign", error, { persist: false });
    return { ok: false, error: getRpcCode(error) ?? error.message };
  }

  const payload = data as { ok?: boolean; plan_key?: string } | null;
  if (!payload?.ok) return { ok: false, error: "No se pudo asignar el plan." };
  await recordAudit({
    clinicId: input.clinicId,
    userId: access.userId,
    entityType: "clinic_entitlement_subscription",
    action: "update",
    metadata: { source: "superadmin_assign", planKey: payload.plan_key ?? planParsed.data, reason: input.reason ?? null },
  });
  return { ok: true, planKey: payload.plan_key ?? planParsed.data };
}

export async function createClinicFeatureOverride(input: {
  clinicId: string;
  featureKey: string;
  enabled: boolean;
  limit?: number | null;
  reason?: string;
  startsAt?: string | null;
  endsAt?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await requireSuperadminSession();
  if (!access.ok) return access;
  if (!isFeatureKey(input.featureKey)) return { ok: false, error: "Feature inválida." };

  const supabase = await createClient();
  const value = input.limit === undefined ? null : input.limit;
  const { error } = await supabase.rpc("upsert_clinic_feature_override", {
    p_clinic_id: input.clinicId,
    p_feature_key: input.featureKey,
    p_enabled: input.enabled,
    p_value: value,
    p_reason: nullToUndefined(input.reason ?? null),
    p_starts_at: nullToUndefined(input.startsAt || null),
    p_ends_at: nullToUndefined(input.endsAt || null),
  });

  if (error) {
    logServerError("entitlements.admin.override", error, { persist: false });
    return { ok: false, error: getRpcCode(error) ?? error.message };
  }
  await recordAudit({
    clinicId: input.clinicId,
    userId: access.userId,
    entityType: "clinic_feature_override",
    action: "update",
    metadata: {
      source: "superadmin_override",
      featureKey: input.featureKey,
      enabled: input.enabled,
      reason: input.reason ?? null,
    },
  });
  return { ok: true };
}

export async function setClinicEntitlementStatus(input: {
  clinicId: string;
  status: string;
  reason?: string;
}): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const access = await requireSuperadminSession();
  if (!access.ok) return access;

  const statusParsed = statusSchema.safeParse(input.status);
  if (!statusParsed.success) return { ok: false, error: "Estado inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_clinic_entitlement_status", {
    p_clinic_id: input.clinicId,
    p_status: statusParsed.data,
    p_reason: nullToUndefined(input.reason ?? null),
  });

  if (error) {
    logServerError("entitlements.admin.status", error, { persist: false });
    return { ok: false, error: getRpcCode(error) ?? error.message };
  }

  const payload = data as { ok?: boolean; status?: string } | null;
  if (!payload?.ok) return { ok: false, error: "No se pudo actualizar el estado comercial." };
  await recordAudit({
    clinicId: input.clinicId,
    userId: access.userId,
    entityType: "clinic_entitlement_subscription",
    action: "update",
    metadata: {
      source: "superadmin_status",
      status: payload.status ?? statusParsed.data,
      reason: input.reason ?? null,
    },
  });
  return { ok: true, status: payload.status ?? statusParsed.data };
}

export async function setClinicEntitlementTrialEnd(input: {
  clinicId: string;
  trialEndsAt?: string | null;
  reason?: string;
}): Promise<{ ok: true; trialEndsAt: string | null } | { ok: false; error: string }> {
  const access = await requireSuperadminSession();
  if (!access.ok) return access;

  const trimmed = input.trialEndsAt?.trim() ?? "";
  let trialEndsAt: string | null = null;
  if (trimmed) {
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return { ok: false, error: "Fecha de prueba inválida." };
    trialEndsAt = parsed.toISOString();
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_clinic_entitlement_trial_end", {
    p_clinic_id: input.clinicId,
    p_trial_ends_at: trialEndsAt,
    p_reason: nullToUndefined(input.reason ?? null),
  });

  if (error) {
    logServerError("entitlements.admin.trial-end", error, { persist: false });
    return { ok: false, error: getRpcCode(error) ?? error.message };
  }

  const payload = data as { ok?: boolean; trial_ends_at?: string | null } | null;
  if (!payload?.ok) return { ok: false, error: "No se pudo actualizar la ventana de prueba." };
  await recordAudit({
    clinicId: input.clinicId,
    userId: access.userId,
    entityType: "clinic_entitlement_subscription",
    action: "update",
    metadata: {
      source: "superadmin_trial_end",
      trialEndsAt: payload.trial_ends_at ?? trialEndsAt,
      reason: input.reason ?? null,
    },
  });
  return { ok: true, trialEndsAt: payload.trial_ends_at ?? trialEndsAt };
}

export async function listEntitlementsAdminOverrides(): Promise<EntitlementsAdminOverrideRow[]> {
  const access = await requireSuperadminSession();
  if (!access.ok) return [];

  const supabase = await createClient();
  const [{ data, error }, { data: clinics }] = await Promise.all([
    supabase
      .from("clinic_feature_overrides")
      .select("clinic_id, enabled, reason, starts_at, ends_at, created_at, features(key)")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("clinics").select("id, name").limit(200),
  ]);

  if (error || !data) {
    logServerError("entitlements.admin.list-overrides", error, { persist: false });
    return [];
  }

  const clinicName = new Map((clinics ?? []).map((clinic) => [clinic.id, clinic.name]));
  const seen = new Set<string>();
  const rows: EntitlementsAdminOverrideRow[] = [];
  for (const row of data) {
    const typed = row as {
      clinic_id: string;
      enabled: boolean;
      reason: string | null;
      starts_at: string | null;
      ends_at: string | null;
      features: { key: string } | { key: string }[] | null;
    };
    if (
      !isOverrideActive({
        enabled: typed.enabled,
        value: null,
        startsAt: typed.starts_at,
        endsAt: typed.ends_at,
      })
    ) {
      continue;
    }
    const feature = Array.isArray(typed.features) ? typed.features[0] : typed.features;
    const featureKey = feature?.key ?? "";
    const dedupeKey = `${typed.clinic_id}:${featureKey}`;
    if (!featureKey || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    rows.push({
      clinicId: typed.clinic_id,
      clinicName: clinicName.get(typed.clinic_id) ?? typed.clinic_id,
      featureKey,
      enabled: typed.enabled,
      endsAt: typed.ends_at,
      reason: typed.reason,
    });
  }
  return rows;
}

export async function clearClinicFeatureOverride(input: {
  clinicId: string;
  featureKey: string;
}): Promise<{ ok: true; cleared: number } | { ok: false; error: string }> {
  const access = await requireSuperadminSession();
  if (!access.ok) return access;
  if (!isFeatureKey(input.featureKey)) return { ok: false, error: "Feature inválida." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("clear_clinic_feature_override", {
    p_clinic_id: input.clinicId,
    p_feature_key: input.featureKey,
  });

  if (error) {
    logServerError("entitlements.admin.clear-override", error, { persist: false });
    return { ok: false, error: getRpcCode(error) ?? error.message };
  }

  const payload = data as { ok?: boolean; cleared?: number } | null;
  if (!payload?.ok) return { ok: false, error: "No se pudo quitar el override." };
  await recordAudit({
    clinicId: input.clinicId,
    userId: access.userId,
    entityType: "clinic_feature_override",
    action: "update",
    metadata: { source: "superadmin_clear_override", featureKey: input.featureKey },
  });
  return { ok: true, cleared: payload.cleared ?? 0 };
}

"use server";

import { revalidatePath } from "next/cache";

import { assignClinicEntitlementPlan } from "@/core/entitlements/admin.server";
import { compareClinicPlans } from "@/core/entitlements/superadmin-catalog.server";
import { requireSuperadminOrDeny } from "@/core/entitlements/superadmin-guard.server";
import { untypedDb } from "@/core/entitlements/untyped-db.server";
import { recordAudit } from "@/core/security/audit-service";
import { createClient } from "@/core/supabase/server";

function revalidateSuperadmin(clinicId?: string) {
  revalidatePath("/superadmin");
  revalidatePath("/superadmin/clinics");
  revalidatePath("/superadmin/plans");
  revalidatePath("/superadmin/features");
  revalidatePath("/superadmin/usage");
  revalidatePath("/superadmin/recommendations");
  revalidatePath("/qa/comercial");
  if (clinicId) revalidatePath(`/superadmin/clinics/${clinicId}`);
}

export async function previewClinicPlanChangeAction(currentPlanKey: string, newPlanKey: string) {
  try {
    const access = await requireSuperadminOrDeny();
    if (!access.ok) return { ok: false as const, error: access.error, diff: null };
    const diff = await compareClinicPlans(currentPlanKey, newPlanKey);
    if (!diff) return { ok: false as const, error: "No se pudo calcular el diff.", diff: null };
    return { ok: true as const, diff, error: null };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "No se pudo comparar los planes.",
      diff: null,
    };
  }
}

export async function assignClinicPlanAction(formData: FormData) {
  try {
    const clinicId = String(formData.get("clinicId") ?? "");
    const planKey = String(formData.get("planKey") ?? "");
    const reason = String(formData.get("reason") ?? "");
    if (!clinicId || !planKey) {
      return { ok: false as const, error: "Faltan clínica o plan." };
    }
    if (!reason.trim()) {
      return { ok: false as const, error: "Indicá un motivo para auditoría." };
    }
    const result = await assignClinicEntitlementPlan({ clinicId, planKey, reason });
    if (!result.ok) return result;
    revalidateSuperadmin(clinicId);
    return result;
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "No se pudo asignar el plan.",
    };
  }
}

export async function setRecommendationStatusAction(formData: FormData) {
  const access = await requireSuperadminOrDeny();
  if (!access.ok) return { ok: false as const, error: access.error };
  const id = String(formData.get("recommendationId") ?? "");
  const status = String(formData.get("status") ?? "");
  const notes = String(formData.get("notes") ?? "");
  const clinicId = String(formData.get("clinicId") ?? "") || undefined;
  const supabase = await createClient();
  const { data, error } = await untypedDb(supabase).rpc("set_clinic_plan_recommendation_status", {
    p_recommendation_id: id,
    p_status: status,
    p_notes: notes || null,
  });
  if (error) return { ok: false as const, error: error.message };
  await recordAudit({
    clinicId,
    entityType: "clinic_plan_recommendation",
    entityId: id,
    action: "update",
    metadata: { source: "superadmin_recommendation_status", status, notes },
  });
  revalidateSuperadmin(clinicId);
  return { ok: true as const, data };
}

export async function updateCommercialPlanAction(formData: FormData) {
  const access = await requireSuperadminOrDeny();
  if (!access.ok) return { ok: false as const, error: access.error };
  const planKey = String(formData.get("planKey") ?? "");
  const name = String(formData.get("name") ?? "");
  const description = String(formData.get("description") ?? "");
  const displayOrder = Number(formData.get("displayOrder") ?? 0);
  const isPublic = formData.get("isPublic") === "true" || formData.get("isPublic") === "on";
  const isActive = formData.get("isActive") === "true" || formData.get("isActive") === "on";
  if (!planKey || !name.trim()) return { ok: false as const, error: "Datos incompletos." };
  if (planKey === "legacy" && isPublic) {
    return { ok: false as const, error: "Legacy no puede ser público." };
  }
  const supabase = await createClient();
  const { data, error } = await untypedDb(supabase).rpc("update_commercial_plan", {
    p_plan_key: planKey,
    p_name: name,
    p_description: description || null,
    p_display_order: Number.isFinite(displayOrder) ? displayOrder : 0,
    p_is_public: isPublic,
    p_is_active: isActive,
    p_metadata: null,
  });
  if (error) return { ok: false as const, error: error.message };
  await recordAudit({
    entityType: "plan",
    entityId: planKey,
    action: "update",
    metadata: {
      source: "superadmin_update_plan",
      name,
      isPublic,
      isActive,
      displayOrder,
    },
  });
  revalidateSuperadmin();
  return { ok: true as const, data };
}

export async function setFeatureActiveAction(formData: FormData) {
  const access = await requireSuperadminOrDeny();
  if (!access.ok) return { ok: false as const, error: access.error };
  const featureKey = String(formData.get("featureKey") ?? "");
  const isActive = String(formData.get("isActive") ?? "true") === "true";
  const supabase = await createClient();
  const { data, error } = await untypedDb(supabase).rpc("set_feature_active", {
    p_feature_key: featureKey,
    p_is_active: isActive,
  });
  if (error) return { ok: false as const, error: error.message };
  await recordAudit({
    entityType: "feature",
    entityId: featureKey,
    action: "update",
    metadata: { source: "superadmin_set_feature_active", isActive },
  });
  revalidateSuperadmin();
  return { ok: true as const, data };
}

export async function upsertPlanFeatureAction(formData: FormData) {
  const access = await requireSuperadminOrDeny();
  if (!access.ok) return { ok: false as const, error: access.error };
  const planKey = String(formData.get("planKey") ?? "");
  const featureKey = String(formData.get("featureKey") ?? "");
  const enabled = String(formData.get("enabled") ?? "true") === "true";
  const limitRaw = String(formData.get("limit") ?? "");
  const limit = limitRaw === "" ? null : Number(limitRaw);
  const supabase = await createClient();
  const { data, error } = await untypedDb(supabase).rpc("upsert_plan_feature_assignment", {
    p_plan_key: planKey,
    p_feature_key: featureKey,
    p_enabled: enabled,
    p_value: Number.isFinite(limit as number) ? limit : null,
  });
  if (error) return { ok: false as const, error: error.message };
  await recordAudit({
    entityType: "plan_feature",
    entityId: `${planKey}:${featureKey}`,
    action: "update",
    metadata: { source: "superadmin_upsert_plan_feature", enabled, limit },
  });
  revalidateSuperadmin();
  return { ok: true as const, data };
}

/** Persist open upgrade recommendations from the central engine (requires migration 129). */
export async function syncPlanRecommendationsAction() {
  const access = await requireSuperadminOrDeny();
  if (!access.ok) return { ok: false as const, error: access.error, synced: 0 };
  const { listSuperadminClinicCommercialRows } = await import(
    "@/core/entitlements/superadmin-clinics.server"
  );
  const rows = await listSuperadminClinicCommercialRows();
  const supabase = await createClient();
  let synced = 0;
  for (const row of rows) {
    if (!row.shouldRecommendUpgrade || !row.recommendedPlan || !row.planKey) continue;
    const { error } = await untypedDb(supabase).rpc("upsert_clinic_plan_recommendation", {
      p_clinic_id: row.clinicId,
      p_current_plan_key: row.planKey,
      p_recommended_plan_key: row.recommendedPlan,
      p_severity: row.recommendationSeverity ?? "warning",
      p_score: 50,
      p_reasons: row.recommendationReasons,
      p_signal_fingerprint: `${row.planKey}|${row.recommendedPlan}|${row.recommendationReasons[0] ?? ""}`,
    });
    if (!error) synced += 1;
  }
  revalidateSuperadmin();
  return { ok: true as const, synced };
}

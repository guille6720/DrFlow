"use server";

import { revalidatePath } from "next/cache";

import {
  assignClinicEntitlementPlan,
  clearClinicFeatureOverride,
  createClinicFeatureOverride,
  setClinicEntitlementStatus,
  setClinicEntitlementTrialEnd,
} from "@/core/entitlements/admin.server";

export async function assignClinicPlanAction(formData: FormData) {
  const clinicId = String(formData.get("clinicId") ?? "");
  const planKey = String(formData.get("planKey") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const result = await assignClinicEntitlementPlan({ clinicId, planKey, reason });
  if (!result.ok) return result;
  revalidatePath("/qa/comercial");
  return result;
}

export async function createFeatureOverrideAction(formData: FormData) {
  const clinicId = String(formData.get("clinicId") ?? "");
  const featureKey = String(formData.get("featureKey") ?? "");
  const enabled = String(formData.get("enabled") ?? "true") === "true";
  const reason = String(formData.get("reason") ?? "");
  const endsAt = String(formData.get("endsAt") ?? "");
  const startsAt = String(formData.get("startsAt") ?? "");
  const limitRaw = String(formData.get("limit") ?? "");
  const limit = limitRaw === "" ? null : Number(limitRaw);
  const result = await createClinicFeatureOverride({
    clinicId,
    featureKey,
    enabled,
    reason,
    startsAt: startsAt || null,
    endsAt: endsAt || null,
    limit: Number.isFinite(limit) ? limit : null,
  });
  if (!result.ok) return result;
  revalidatePath("/qa/comercial");
  revalidatePath("/superadmin");
  revalidatePath("/superadmin/clinics");
  if (clinicId) revalidatePath(`/superadmin/clinics/${clinicId}`);
  return result;
}

export async function setClinicEntitlementStatusAction(formData: FormData) {
  const clinicId = String(formData.get("clinicId") ?? "");
  const status = String(formData.get("status") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const result = await setClinicEntitlementStatus({ clinicId, status, reason });
  if (!result.ok) return result;
  revalidatePath("/qa/comercial");
  return result;
}

export async function setClinicEntitlementTrialEndAction(formData: FormData) {
  const clinicId = String(formData.get("clinicId") ?? "");
  const trialEndsAt = String(formData.get("trialEndsAt") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const result = await setClinicEntitlementTrialEnd({
    clinicId,
    trialEndsAt: trialEndsAt || null,
    reason,
  });
  if (!result.ok) return result;
  revalidatePath("/qa/comercial");
  return result;
}

export async function clearFeatureOverrideAction(formData: FormData) {
  const clinicId = String(formData.get("clinicId") ?? "");
  const featureKey = String(formData.get("featureKey") ?? "");
  const result = await clearClinicFeatureOverride({ clinicId, featureKey });
  if (!result.ok) return result;
  revalidatePath("/qa/comercial");
  revalidatePath("/superadmin");
  revalidatePath("/superadmin/clinics");
  if (clinicId) revalidatePath(`/superadmin/clinics/${clinicId}`);
  return result;
}

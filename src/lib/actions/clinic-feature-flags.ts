"use server";

import { revalidatePath } from "next/cache";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { logAudit } from "@/core/auth/session.actions";
import { getActiveClinicId, getSession } from "@/core/auth/session.server";
import { revalidateClinicFeatureFlagsCache } from "@/core/cache/revalidate-clinic-cache";
import {
  CLINICAL_RESEARCH_PRIVACY_LEGAL_REVIEW,
  CLINICAL_RESEARCH_PROTOCOLS_FLAG,
} from "@/core/compliance/clinical-research-ai";
import { requireAddonFeatureAccess } from "@/core/entitlements/entitlements.server";
import { addonFeatureForClinicFeatureFlag } from "@/core/entitlements/flag-features";
import { createClient } from "@/core/supabase/server";

import {
  type FeatureFlagId,
  getFeatureFlagDefinition,
  listFeatureFlags,
} from "@/features/flags/lib/registry";

import { getCachedClinicFeatureFlags } from "@/lib/server/cached-clinic-queries";

export async function enableClinicalResearchProtocols(input: {
  acknowledgedLegalReview: boolean;
}): Promise<{ success?: true; error?: string }> {
  if (!input.acknowledgedLegalReview) {
    return {
      error:
        "Confirmá que completaste la revisión legal y de privacidad documentada antes de activar protocolos de investigación.",
    };
  }

  const result = await updateClinicFeatureFlag(CLINICAL_RESEARCH_PROTOCOLS_FLAG, true);
  if (result.error) return result;

  const clinicId = await getActiveClinicId();
  if (clinicId) {
    await logAudit({
      clinicId,
      entityType: "feature_flag",
      action: "update",
      metadata: {
        flag_id: CLINICAL_RESEARCH_PROTOCOLS_FLAG,
        enabled: true,
        legal_review_acknowledged: true,
        review_checklist: CLINICAL_RESEARCH_PRIVACY_LEGAL_REVIEW.filter(
          (item) => item.status === "required_before_activation"
        ).map((item) => item.id),
      },
    });
  }

  return { success: true };
}

export async function updateClinicFeatureFlag(
  flagId: FeatureFlagId,
  enabled: boolean
): Promise<{ success?: true; error?: string }> {
  const access = await requireClinicPermission("manageSettings");
  if (!access.ok) return { error: access.error };

  getFeatureFlagDefinition(flagId);

  if (enabled) {
    const addon = addonFeatureForClinicFeatureFlag(flagId);
    if (addon) {
      const entitlement = await requireAddonFeatureAccess(addon);
      if (!entitlement.ok) return { error: entitlement.error };
    }
  }

  const user = await getSession();
  if (!user) return { error: "Sin sesión" };

  const clinicId = await getActiveClinicId();
  if (!clinicId) return { error: "Sin clínica activa" };

  const supabase = await createClient();
  const { error } = await supabase.from("clinic_feature_flags").upsert(
    {
      clinic_id: clinicId,
      flag_id: flagId,
      enabled,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clinic_id,flag_id" }
  );

  if (error) return { error: "No se pudo actualizar la función" };

  await logAudit({
    clinicId,
    entityType: "feature_flag",
    action: "update",
    metadata: { flag_id: flagId, enabled },
  });

  revalidateClinicFeatureFlagsCache(clinicId);
  revalidatePath("/configuracion");
  revalidatePath("/", "layout");

  return { success: true };
}

export async function getClinicFeatureFlagSettings(): Promise<{
  data?: Array<{
    id: FeatureFlagId;
    label: string;
    description: string;
    category: string;
    enabled: boolean;
    requiresPlugin?: string;
  }>;
  error?: string;
}> {
  const access = await requireClinicPermission("manageSettings");
  if (!access.ok) return { error: access.error };

  const clinicId = await getActiveClinicId();
  if (!clinicId) return { error: "Sin clínica activa" };

  const flags = await getCachedClinicFeatureFlags(clinicId);
  return {
    data: listFeatureFlags().map((def) => ({
      id: def.id,
      label: def.label,
      description: def.description,
      category: def.category,
      enabled: flags[def.id] ?? def.defaultEnabled,
      requiresPlugin: def.requiresPlugin,
    })),
  };
}

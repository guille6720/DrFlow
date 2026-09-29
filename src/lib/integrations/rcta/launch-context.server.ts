import "server-only";

import { getActiveClinicId, getPermissionContext, getSession } from "@/core/auth/session.server";
import { isFeatureEnabled } from "@/core/customizations/customizations.server";
import { hasPermission } from "@/core/permissions/roles";
import { hasProduct } from "@/core/products/product-access";
import { PRODUCTS } from "@/core/products/products";
import { loadClinicProducts } from "@/core/products/products.server";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

import { hasAnyRctaAccess, RCTA_FEATURE_KEYS, resolveRctaAccess } from "@/lib/integrations/rcta/access";
import { getRctaLaunchUrl } from "@/lib/integrations/rcta/client";
import { buildRctaPatientContext, type RctaPatientRow } from "@/lib/integrations/rcta/patient-context";
import type { RctaLaunchContextResult } from "@/lib/integrations/rcta/types";

/**
 * Clinic and user come from the session (never from the client). The patient is loaded only after
 * access is confirmed, filtered by the active clinic and by RLS. Nothing is logged or sent to RCTA.
 */
export async function loadRctaLaunchContext(patientId: string): Promise<RctaLaunchContextResult> {
  const id = parseEntityId(patientId, "Paciente");
  if (!id.ok) return { ok: false, reason: "invalid_patient" };

  const [clinicId, perm, user] = await Promise.all([getActiveClinicId(), getPermissionContext(), getSession()]);
  if (!user || !clinicId) return { ok: false, reason: "unauthenticated" };

  const can = (key: "issuePrescriptions" | "issueMedicalOrders" | "viewClinicalRecords") =>
    hasPermission(perm.role, key, perm.isSuperadmin, perm.permissionOverrides);
  if (!can("viewClinicalRecords")) return { ok: false, reason: "not_allowed" };

  const [products, integration, prescriptions, medicalOrders] = await Promise.all([
    loadClinicProducts(clinicId),
    isFeatureEnabled(clinicId, RCTA_FEATURE_KEYS.integration),
    isFeatureEnabled(clinicId, RCTA_FEATURE_KEYS.prescriptions),
    isFeatureEnabled(clinicId, RCTA_FEATURE_KEYS.medicalOrders),
  ]);

  const access = resolveRctaAccess({
    canIssuePrescriptions: can("issuePrescriptions"),
    canIssueMedicalOrders: can("issueMedicalOrders"),
    productEntitled: hasProduct(products, PRODUCTS.CLINIC),
    features: { integration, prescriptions, medicalOrders },
  });
  if (!hasAnyRctaAccess(access)) return { ok: false, reason: "not_allowed" };

  const supabase = await createClient();
  const { data } = await supabase
    .from("patients")
    .select("first_name, last_name, document_type, document_number, birth_date, sex, insurance_provider, insurance_number")
    .eq("id", id.data)
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (!data) return { ok: false, reason: "not_found" };

  return {
    ok: true,
    launchUrl: getRctaLaunchUrl("prescription"),
    access,
    patient: buildRctaPatientContext(data as RctaPatientRow),
  };
}

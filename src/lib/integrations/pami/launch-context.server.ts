import "server-only";

import { getActiveClinicId, getPermissionContext, getSession } from "@/core/auth/session.server";
import { isFeatureEnabled } from "@/core/customizations/customizations.server";
import { hasPermission } from "@/core/permissions/roles";
import { hasProduct } from "@/core/products/product-access";
import { PRODUCTS } from "@/core/products/products";
import { loadClinicProducts } from "@/core/products/products.server";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

import { hasAnyPamiAccess, PAMI_FEATURE_KEYS, resolvePamiAccess } from "@/lib/integrations/pami/access";
import { getPamiLaunchUrl } from "@/lib/integrations/pami/client";
import { buildPamiPatientContext, type PamiPatientRow } from "@/lib/integrations/pami/patient-context";
import type { PamiLaunchContextResult } from "@/lib/integrations/pami/types";

/**
 * Clinic and user come from the session (never from the client). The patient is loaded only after
 * access is confirmed, filtered by the active clinic and by RLS. Nothing is logged or sent to PAMI.
 */
export async function loadPamiLaunchContext(patientId: string): Promise<PamiLaunchContextResult> {
  const id = parseEntityId(patientId, "Paciente");
  if (!id.ok) return { ok: false, reason: "invalid_patient" };

  const [clinicId, perm, user] = await Promise.all([getActiveClinicId(), getPermissionContext(), getSession()]);
  if (!user || !clinicId) return { ok: false, reason: "unauthenticated" };

  const can = (key: "issuePrescriptions" | "issueMedicalOrders" | "viewClinicalRecords") =>
    hasPermission(perm.role, key, perm.isSuperadmin, perm.permissionOverrides);
  if (!can("viewClinicalRecords")) return { ok: false, reason: "not_allowed" };

  const [products, integration, prescriptions, medicalOrders] = await Promise.all([
    loadClinicProducts(clinicId),
    isFeatureEnabled(clinicId, PAMI_FEATURE_KEYS.integration),
    isFeatureEnabled(clinicId, PAMI_FEATURE_KEYS.prescriptions),
    isFeatureEnabled(clinicId, PAMI_FEATURE_KEYS.medicalOrders),
  ]);

  const access = resolvePamiAccess({
    canIssuePrescriptions: can("issuePrescriptions"),
    canIssueMedicalOrders: can("issueMedicalOrders"),
    productEntitled: hasProduct(products, PRODUCTS.CLINIC),
    features: { integration, prescriptions, medicalOrders },
  });
  if (!hasAnyPamiAccess(access)) return { ok: false, reason: "not_allowed" };

  const supabase = await createClient();
  const { data } = await supabase
    .from("patients")
    .select(
      "first_name, last_name, document_type, document_number, cuil, birth_date, sex, insurance_provider, insurance_number"
    )
    .eq("id", id.data)
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (!data) return { ok: false, reason: "not_found" };

  return {
    ok: true,
    prescriptionUrl: getPamiLaunchUrl("prescription"),
    medicalOrderUrl: getPamiLaunchUrl("medical_order"),
    access,
    patient: buildPamiPatientContext(data as PamiPatientRow),
  };
}

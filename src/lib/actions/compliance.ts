"use server";

import { createClient } from "@/lib/supabase/server";
import {
  getActiveClinic,
  getActiveClinicId,
  logAudit,
} from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/roles";
import {
  LEGAL_PRIVACY_VERSION,
  LEGAL_TERMS_VERSION,
} from "@/lib/legal/documents";

export async function applyClinicLegalAcceptance(clinicId: string) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("clinics")
    .update({
      legal_terms_version: LEGAL_TERMS_VERSION,
      legal_terms_accepted_at: now,
      legal_privacy_version: LEGAL_PRIVACY_VERSION,
    })
    .eq("id", clinicId);

  if (error) {
    console.error("legal acceptance update failed:", error.message);
    return;
  }

  await logAudit({
    clinicId,
    entityType: "legal",
    action: "create",
    metadata: {
      terms_version: LEGAL_TERMS_VERSION,
      privacy_version: LEGAL_PRIVACY_VERSION,
    },
  });
}

export async function exportPatientArcoBundle(patientId: string) {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!clinicId || !hasPermission(role, "viewClinicalRecords", isSuperadmin)) {
    return { error: "Sin permisos para exportar datos clínicos del paciente." };
  }

  const supabase = await createClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .single();

  if (!patient) return { error: "Paciente no encontrado." };

  const [{ data: records }, { data: appointments }, { data: consents }, { data: attachments }] =
    await Promise.all([
      supabase
        .from("clinical_records")
        .select("id, created_at, diagnosis, chief_complaint, evolution, indications")
        .eq("patient_id", patientId)
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false }),
      supabase
        .from("appointments")
        .select("id, start_at, status, notes, booking_source")
        .eq("patient_id", patientId)
        .order("start_at", { ascending: false }),
      supabase
        .from("consent_records")
        .select("consent_type, granted, granted_at, document_version, created_at")
        .eq("patient_id", patientId)
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false }),
      supabase
        .from("patient_attachments")
        .select("id, file_name, category, created_at, file_size")
        .eq("patient_id", patientId)
        .eq("clinic_id", clinicId),
    ]);

  await logAudit({
    clinicId,
    entityType: "patient",
    entityId: patientId,
    action: "export",
    metadata: { reason: "arco_export_bundle" },
  });

  const payload = {
    exported_at: new Date().toISOString(),
    legal_basis:
      "Exportación a pedido del responsable del tratamiento (consultorio) para ejercicio de derechos ARCO del titular — Ley 25.326.",
    patient,
    clinical_records: records ?? [],
    appointments: appointments ?? [],
    consent_records: consents ?? [],
    attachments_metadata: attachments ?? [],
  };

  return { json: JSON.stringify(payload, null, 2) };
}

export async function getClinicComplianceSummary() {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!clinicId || !hasPermission(role, "manageSettings", isSuperadmin)) {
    return { error: "Sin permisos." };
  }

  const supabase = await createClient();

  const [{ data: clinic }, { count: consentCount }] = await Promise.all([
    supabase
      .from("clinics")
      .select(
        "name, legal_terms_version, legal_terms_accepted_at, legal_privacy_version, trial_ends_at"
      )
      .eq("id", clinicId)
      .single(),
    supabase
      .from("consent_records")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId),
  ]);

  return {
    clinic,
    consentCount: consentCount ?? 0,
    currentTermsVersion: LEGAL_TERMS_VERSION,
    currentPrivacyVersion: LEGAL_PRIVACY_VERSION,
  };
}

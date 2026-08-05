"use server";

import { getActiveClinic, getActiveClinicId, getSession, logAudit } from "@/core/auth/session";
import { applyClinicLegalAcceptanceInternal } from "@/core/legal/apply-clinic-legal-acceptance";
import {
  LEGAL_PRIVACY_VERSION,
  LEGAL_TERMS_VERSION,
} from "@/core/legal/documents";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

export async function applyClinicLegalAcceptance(clinicId: string) {
  const idParsed = parseEntityId(clinicId, "Clínica");
  if (!idParsed.ok) return { error: idParsed.error };

  const user = await getSession();
  if (!user) return { error: "Sesión requerida" };

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("clinic_members")
    .select("role")
    .eq("clinic_id", idParsed.data)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!membership) {
    return { error: "Sin permisos para esta clínica" };
  }

  const { role, isSuperadmin } = await getActiveClinic();
  const activeClinicId = await getActiveClinicId();
  const canAccept =
    isSuperadmin ||
    hasPermission(role, "manageSettings", isSuperadmin) ||
    (activeClinicId === idParsed.data && membership.role === "clinic_admin");

  if (!canAccept) {
    return { error: "Sin permisos para registrar aceptación legal" };
  }

  return applyClinicLegalAcceptanceInternal(idParsed.data);
}

export async function exportPatientArcoBundle(patientId: string) {
  const patientParsed = parseEntityId(patientId, "Paciente");
  if (!patientParsed.ok) return { error: patientParsed.error };

  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!clinicId || !hasPermission(role, "viewClinicalRecords", isSuperadmin)) {
    return { error: "Sin permisos para exportar datos clínicos del paciente." };
  }

  const supabase = await createClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientParsed.data)
    .eq("clinic_id", clinicId)
    .single();

  if (!patient) return { error: "Paciente no encontrado." };

  const [{ data: records }, { data: appointments }, { data: consents }, { data: attachments }] =
    await Promise.all([
      supabase
        .from("clinical_records")
        .select("id, created_at, diagnosis, chief_complaint, evolution, indications")
        .eq("patient_id", patientParsed.data)
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false }),
      supabase
        .from("appointments")
        .select("id, start_at, status, notes, booking_source")
        .eq("patient_id", patientParsed.data)
        .eq("clinic_id", clinicId)
        .order("start_at", { ascending: false }),
      supabase
        .from("consent_records")
        .select("consent_type, granted, granted_at, document_version, created_at")
        .eq("patient_id", patientParsed.data)
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false }),
      supabase
        .from("patient_attachments")
        .select("id, file_name, category, created_at, file_size")
        .eq("patient_id", patientParsed.data)
        .eq("clinic_id", clinicId),
    ]);

  await logAudit({
    clinicId,
    entityType: "patient",
    entityId: patientParsed.data,
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

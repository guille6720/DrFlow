"use server";

import { getActiveClinic, getActiveClinicId, getSession } from "@/core/auth/session.server";
import { logAudit } from "@/core/auth/session.actions";
import {
  buildPatientHabeasDataPayload,
  fetchClinicHabeasDataPayload,
  fetchPatientHabeasDataSections,
} from "@/core/compliance/habeas-data-export";
import { applyClinicLegalAcceptanceInternal } from "@/core/legal/apply-clinic-legal-acceptance";
import {
  LEGAL_PRIVACY_VERSION,
  LEGAL_TERMS_VERSION,
} from "@/core/legal/documents";
import { hasPermission } from "@/core/permissions/roles";
import { PATIENT_DETAIL_COLUMNS } from "@/core/supabase/select-columns";
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
    .select(PATIENT_DETAIL_COLUMNS)
    .eq("id", patientParsed.data)
    .eq("clinic_id", clinicId)
    .single();

  if (!patient) return { error: "Paciente no encontrado." };

  const sections = await fetchPatientHabeasDataSections(supabase, clinicId, patientParsed.data);
  const exportedAt = new Date().toISOString();
  const payload = buildPatientHabeasDataPayload(patient, sections, exportedAt);

  await logAudit({
    clinicId,
    entityType: "patient",
    entityId: patientParsed.data,
    action: "export",
    metadata: {
      reason: "habeas_data_patient_export",
      export_type: payload.export_type,
      export_version: payload.export_version,
      summary: payload.summary,
    },
  });

  return { json: JSON.stringify(payload, null, 2) };
}

export async function exportClinicHabeasDataBundle() {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!clinicId || !hasPermission(role, "manageSettings", isSuperadmin)) {
    return { error: "Sin permisos para exportar datos de la clínica." };
  }

  const supabase = await createClient();
  const payload = await fetchClinicHabeasDataPayload(supabase, clinicId);

  await logAudit({
    clinicId,
    entityType: "clinic",
    entityId: clinicId,
    action: "export",
    metadata: {
      reason: "habeas_data_clinic_export",
      export_type: payload.export_type,
      export_version: payload.export_version,
      summary: payload.summary,
    },
  });

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

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logAudit } from "@/core/auth/session.actions";
import { getActiveClinic, getActiveClinicId, getSession } from "@/core/auth/session.server";
import {
  type InformedConsentRecord,
  mapInformedConsentRow,
} from "@/core/compliance/informed-consent-types";
import { CONSENT_TYPES } from "@/core/legal/documents";
import { INFORMED_CONSENT_DOCUMENT_VERSION } from "@/core/legal/informed-consent";
import { hasPermission } from "@/core/permissions/roles";
import { getAuditRequestContext } from "@/core/security/audit-context";
import { createClient } from "@/core/supabase/server";
import { parseEntityId } from "@/core/validations/params";

const recordInformedConsentSchema = z.object({
  patient_id: z.string().uuid("Paciente inválido"),
  clinical_record_id: z.string().uuid("Consulta inválida"),
  appointment_id: z.string().uuid().optional().nullable(),
  procedure_description: z
    .string()
    .trim()
    .min(3, "Describí el acto o procedimiento informado."),
  signature_name: z
    .string()
    .trim()
    .min(2, "Indicá el nombre del paciente o representante."),
  notes: z.string().trim().max(2000).optional().nullable(),
  informed_consent_acknowledged: z.enum(["true"], {
    error: "Debés confirmar el consentimiento informado.",
  }),
});

function rpcErrorMessage(code: string | undefined): string {
  switch (code) {
    case "INFORMED_CONSENT_ALREADY_RECORDED":
      return "Ya existe un consentimiento informado registrado para esta consulta.";
    case "CLINICAL_RECORD_NOT_FOUND":
      return "Consulta clínica no encontrada.";
    case "PATIENT_NOT_FOUND":
      return "Paciente no encontrado.";
    case "FORBIDDEN":
      return "Sin permisos para registrar consentimiento informado.";
    case "PROCEDURE_REQUIRED":
      return "Describí el acto o procedimiento informado.";
    case "SIGNATURE_REQUIRED":
      return "Indicá el nombre del paciente o representante.";
    default:
      return "No se pudo registrar el consentimiento informado.";
  }
}

export async function getInformedConsentForClinicalRecord(
  clinicalRecordId: string
): Promise<{ data?: InformedConsentRecord | null; error?: string }> {
  const parsed = parseEntityId(clinicalRecordId, "Consulta");
  if (!parsed.ok) return { error: parsed.error };

  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!clinicId || !hasPermission(role, "viewClinicalRecords", isSuperadmin)) {
    return { error: "Sin permisos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consent_records")
    .select(
      "id, clinical_record_id, patient_id, appointment_id, granted, granted_at, document_version, procedure_description, signature_name, notes, created_at, profiles:recorded_by(full_name)"
    )
    .eq("clinic_id", clinicId)
    .eq("clinical_record_id", parsed.data)
    .eq("consent_type", CONSENT_TYPES.informedConsentClinicalAct)
    .eq("granted", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { error: "No se pudo cargar el consentimiento." };
  return { data: data ? mapInformedConsentRow(data) : null };
}

export async function recordInformedConsent(formData: FormData) {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  const user = await getSession();

  if (!clinicId || !user || !hasPermission(role, "editClinicalRecords", isSuperadmin)) {
    return { error: "Sin permisos para registrar consentimiento informado." };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = recordInformedConsentSchema.safeParse({
    ...raw,
    appointment_id: raw.appointment_id || null,
    notes: raw.notes || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const ctx = await getAuditRequestContext();
  const supabase = await createClient();

  const { data: consentId, error } = await supabase.rpc("record_informed_consent", {
    p_clinic_id: clinicId,
    p_patient_id: parsed.data.patient_id,
    p_clinical_record_id: parsed.data.clinical_record_id,
    p_procedure_description: parsed.data.procedure_description,
    p_signature_name: parsed.data.signature_name,
    p_document_version: INFORMED_CONSENT_DOCUMENT_VERSION,
    p_appointment_id: parsed.data.appointment_id ?? null,
    p_notes: parsed.data.notes ?? null,
    p_ip_address: ctx.ip_address ?? null,
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("INFORMED_CONSENT_ALREADY_RECORDED")) {
      return { error: rpcErrorMessage("INFORMED_CONSENT_ALREADY_RECORDED") };
    }
    if (msg.includes("FORBIDDEN")) return { error: rpcErrorMessage("FORBIDDEN") };
    if (msg.includes("CLINICAL_RECORD_NOT_FOUND")) {
      return { error: rpcErrorMessage("CLINICAL_RECORD_NOT_FOUND") };
    }
    return { error: rpcErrorMessage(undefined) };
  }

  await logAudit({
    clinicId,
    module: "compliance",
    what: "Registró consentimiento informado digital",
    entityType: "consent",
    entityId: String(consentId),
    patientId: parsed.data.patient_id,
    action: "create",
    metadata: {
      consent_type: CONSENT_TYPES.informedConsentClinicalAct,
      clinical_record_id: parsed.data.clinical_record_id,
      document_version: INFORMED_CONSENT_DOCUMENT_VERSION,
    },
  });

  revalidatePath(`/pacientes/${parsed.data.patient_id}`);
  revalidatePath(`/historias/${parsed.data.clinical_record_id}`);

  const loaded = await getInformedConsentForClinicalRecord(parsed.data.clinical_record_id);
  return { data: loaded.data ?? null };
}

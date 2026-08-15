"use server";

import { revalidatePath } from "next/cache";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { logAudit } from "@/core/auth/session.actions";
import { getSession } from "@/core/auth/session.server";
import { getAuditRequestContext } from "@/core/security/audit-context";
import { verifyClinicalRecordForeignKeys } from "@/core/security/ownership-guard";
import { createClient } from "@/core/supabase/server";
import { firstZodIssue, parseEntityId } from "@/core/validations/params";
import { clinicalRecordSchema } from "@/core/validations/schemas";

import {
  createClinicalRecordEntry,
  updateClinicalRecordEntry,
} from "@/features/historias/services/clinical-records.service";

export async function createClinicalRecord(formData: FormData) {
  const access = await requireClinicPermission("editClinicalRecords");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;
  const user = await getSession();
  if (!user) return { error: "Sin sesión" };

  const raw = Object.fromEntries(formData.entries());
  const parsed = clinicalRecordSchema.safeParse({
    ...raw,
    appointment_id: raw.appointment_id || null,
  });

  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const supabase = await createClient();
  const ownership = await verifyClinicalRecordForeignKeys(supabase, clinicId, {
    patientId: parsed.data.patient_id,
    professionalId: parsed.data.professional_id,
    appointmentId: parsed.data.appointment_id,
  });
  if (!ownership.ok) return { error: ownership.error };

  const ctx = await getAuditRequestContext();

  const result = await createClinicalRecordEntry(supabase, {
    clinicId,
    userId: user.id,
    parsed: parsed.data,
    consultationModalityRaw: raw.consultation_modality,
    auditContext: ctx,
  });

  if (!result.ok) return { error: result.error };

  if (parsed.data.appointment_id) {
    revalidatePath("/agenda");
    revalidatePath("/dashboard");
    revalidatePath("/atenciones");
  }

  void logAudit({
    clinicId,
    module: "clinical",
    what: "Creó consulta clínica (SOAP)",
    entityType: "clinical_record",
    entityId: String(result.data.id),
    patientId: parsed.data.patient_id,
    action: "create",
    newValues: result.data,
  });

  revalidatePath("/consultas");
  revalidatePath(`/pacientes/${parsed.data.patient_id}`, "page");
  return { data: result.data };
}

export async function updateClinicalRecordConsultationAt(
  recordId: string,
  consultationAtIso: string
) {
  const access = await requireClinicPermission("editClinicalRecords");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;

  const idParsed = parseEntityId(recordId, "Consulta");
  if (!idParsed.ok) return { error: idParsed.error };

  const parsedDate = new Date(consultationAtIso);
  if (Number.isNaN(parsedDate.getTime())) {
    return { error: "Fecha de consulta inválida." };
  }

  const supabase = await createClient();
  const { data: record, error: fetchError } = await supabase
    .from("clinical_records")
    .select(
      "id, patient_id, professional_id, appointment_id, chief_complaint, diagnosis, evolution, indications"
    )
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!record) return { error: "Consulta no encontrada." };

  const formData = new FormData();
  formData.set("patient_id", record.patient_id);
  formData.set("professional_id", record.professional_id);
  if (record.appointment_id) formData.set("appointment_id", record.appointment_id);
  formData.set("chief_complaint", record.chief_complaint ?? "");
  formData.set("diagnosis", record.diagnosis ?? "");
  formData.set("evolution", record.evolution ?? "");
  formData.set("indications", record.indications ?? "");
  formData.set("consultation_at", parsedDate.toISOString());

  return updateClinicalRecord(idParsed.data, formData);
}

export async function updateClinicalRecord(id: string, formData: FormData) {
  const access = await requireClinicPermission("editClinicalRecords");
  if (!access.ok) return { error: access.error };
  const { clinicId } = access;
  const user = await getSession();
  if (!user) return { error: "Sin sesión" };

  const idParsed = parseEntityId(id, "Consulta");
  if (!idParsed.ok) return { error: idParsed.error };

  const raw = Object.fromEntries(formData.entries());
  const parsed = clinicalRecordSchema.safeParse({
    ...raw,
    appointment_id: raw.appointment_id || null,
  });
  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const supabase = await createClient();
  const ownership = await verifyClinicalRecordForeignKeys(supabase, clinicId, {
    patientId: parsed.data.patient_id,
    professionalId: parsed.data.professional_id,
    appointmentId: parsed.data.appointment_id,
  });
  if (!ownership.ok) return { error: ownership.error };

  const ctx = await getAuditRequestContext();

  const result = await updateClinicalRecordEntry(supabase, {
    recordId: idParsed.data,
    clinicId,
    userId: user.id,
    parsed: parsed.data,
    auditContext: ctx,
  });

  if (!result.ok) return { error: result.error };

  await logAudit({
    clinicId,
    module: "clinical",
    what: "Modificó consulta clínica (SOAP)",
    entityType: "clinical_record",
    entityId: idParsed.data,
    patientId: String(result.data.old.patient_id),
    action: "update",
    oldValues: result.data.old,
    newValues: result.data.data,
  });

  revalidatePath(`/historias/${idParsed.data}`, "page");
  revalidatePath(`/pacientes/${String(result.data.data.patient_id)}`, "page");
  revalidatePath("/consultas");
  return { success: true };
}

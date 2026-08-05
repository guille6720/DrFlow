"use server";

import { revalidatePath } from "next/cache";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { getSession, logAudit } from "@/core/auth/session.server";
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

  await logAudit({
    clinicId,
    module: "clinical",
    what: "Creó consulta clínica (SOAP)",
    entityType: "clinical_record",
    entityId: String(result.data.id),
    patientId: parsed.data.patient_id,
    action: "create",
    newValues: result.data,
  });

  revalidatePath("/historias");
  return { data: result.data };
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

  revalidatePath("/historias");
  revalidatePath(`/historias/${idParsed.data}`);
  return { success: true };
}

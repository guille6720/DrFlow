"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, logAudit } from "@/lib/auth/session";
import { clinicalRecordSchema } from "@/lib/validations/schemas";
import { requireClinicPermission } from "@/lib/actions/clinic-guard";
import { getAuditRequestContext } from "@/lib/security/audit-context";
import {
  createClinicalRecordEntry,
  updateClinicalRecordEntry,
} from "@/lib/services/clinical-records.service";

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

  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
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

  const raw = Object.fromEntries(formData.entries());
  const parsed = clinicalRecordSchema.safeParse({
    ...raw,
    appointment_id: raw.appointment_id || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const ctx = await getAuditRequestContext();

  const result = await updateClinicalRecordEntry(supabase, {
    recordId: id,
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
    entityId: id,
    patientId: String(result.data.old.patient_id),
    action: "update",
    oldValues: result.data.old,
    newValues: result.data.data,
  });

  revalidatePath("/historias");
  revalidatePath(`/historias/${id}`);
  return { success: true };
}

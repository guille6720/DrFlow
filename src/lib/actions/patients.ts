"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/auth/session";
import { patientSchema, sanitizePatientFields } from "@/lib/validations/schemas";
import { patientAdminSchema } from "@/lib/validations/cash-schemas";
import { requireClinicPermission } from "@/lib/actions/clinic-guard";
import {
  createPatientRecord,
  isAdminOnlyPatientRole,
  updatePatientRecord,
  type SanitizedPatient,
} from "@/lib/services/patients.service";

export async function createPatient(formData: FormData) {
  const access = await requireClinicPermission("managePatients");
  if (!access.ok) return { error: access.error };
  const { clinicId, role, isSuperadmin } = access;

  const raw = Object.fromEntries(formData.entries());
  const adminOnly = isAdminOnlyPatientRole(role, isSuperadmin);
  const parsed = adminOnly
    ? patientAdminSchema.safeParse(raw)
    : patientSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  const sanitized = sanitizePatientFields(
    parsed.data as Parameters<typeof sanitizePatientFields>[0]
  ) as SanitizedPatient;
  const supabase = await createClient();

  const result = await createPatientRecord(supabase, {
    clinicId,
    adminOnly,
    sanitized,
    insurancePlan: (raw.insurance_plan as string) || null,
  });

  if (!result.ok) return { error: result.error };

  await logAudit({
    clinicId,
    module: "patients",
    what: "Creó ficha de paciente",
    entityType: "patient",
    entityId: result.data.id,
    patientId: result.data.id,
    action: "create",
    newValues: result.data as unknown as Record<string, unknown>,
  });

  revalidatePath("/pacientes");
  return { data: result.data };
}

export async function updatePatient(id: string, formData: FormData) {
  const access = await requireClinicPermission("managePatients");
  if (!access.ok) return { error: access.error };
  const { clinicId, role, isSuperadmin } = access;

  const raw = Object.fromEntries(formData.entries());
  const adminOnly = isAdminOnlyPatientRole(role, isSuperadmin);
  const parsed = adminOnly
    ? patientAdminSchema.safeParse(raw)
    : patientSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const sanitized = sanitizePatientFields(
    parsed.data as Parameters<typeof sanitizePatientFields>[0]
  ) as SanitizedPatient;
  const supabase = await createClient();

  const result = await updatePatientRecord(supabase, {
    patientId: id,
    clinicId,
    adminOnly,
    sanitized,
    insurancePlan: (raw.insurance_plan as string) || null,
  });

  if (!result.ok) return { error: result.error };

  const { oldPatient, updatedPatient } = result.data;

  await logAudit({
    clinicId,
    module: "patients",
    what: "Actualizó ficha de paciente",
    entityType: "patient",
    entityId: id,
    patientId: id,
    action: "update",
    oldValues: oldPatient as unknown as Record<string, unknown>,
    newValues: (updatedPatient ?? oldPatient) as unknown as Record<string, unknown>,
  });

  revalidatePath("/pacientes");
  revalidatePath(`/pacientes/${id}`);
  return { success: true };
}

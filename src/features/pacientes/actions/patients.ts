"use server";

import { revalidatePath } from "next/cache";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { logAudit } from "@/core/auth/session.server";
import { createClient } from "@/core/supabase/server";
import { patientAdminSchema } from "@/core/validations/cash-schemas";
import { firstZodIssue, parseEntityId } from "@/core/validations/params";
import { patientSchema, sanitizePatientFields } from "@/core/validations/schemas";

import {
  createPatientRecord,
  isAdminOnlyPatientRole,
  type SanitizedPatient,
  updatePatientRecord,
} from "@/features/pacientes/services/patients.service";

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
    return { error: firstZodIssue(parsed.error) };
  }

  const sanitized = sanitizePatientFields(
    parsed.data as Parameters<typeof sanitizePatientFields>[0]
  ) as SanitizedPatient;
  const supabase = await createClient();

  const result = await createPatientRecord(supabase, {
    clinicId,
    adminOnly,
    sanitized,
    insurancePlan: parsed.data.insurance_plan ?? null,
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

  const idParsed = parseEntityId(id, "Paciente");
  if (!idParsed.ok) return { error: idParsed.error };

  const raw = Object.fromEntries(formData.entries());
  const adminOnly = isAdminOnlyPatientRole(role, isSuperadmin);
  const parsed = adminOnly
    ? patientAdminSchema.safeParse(raw)
    : patientSchema.safeParse(raw);
  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const sanitized = sanitizePatientFields(
    parsed.data as Parameters<typeof sanitizePatientFields>[0]
  ) as SanitizedPatient;
  const supabase = await createClient();

  const result = await updatePatientRecord(supabase, {
    patientId: idParsed.data,
    clinicId,
    adminOnly,
    sanitized,
    insurancePlan: parsed.data.insurance_plan ?? null,
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

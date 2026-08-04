"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/auth/session";
import { patientSchema, sanitizePatientFields } from "@/lib/validations/schemas";
import { patientAdminSchema } from "@/lib/validations/cash-schemas";
import { requireClinicPermission } from "@/lib/actions/clinic-guard";
import type { UserRole } from "@/types/database";
import {
  extractClinicalProfileFields,
  upsertPatientClinicalProfile,
} from "@/lib/server/patient-clinical-profile";

const ADMIN_ONLY_ROLES: UserRole[] = ["secretary"];

function isAdminOnlyRole(role: UserRole | null, isSuperadmin: boolean): boolean {
  if (isSuperadmin) return false;
  return role != null && ADMIN_ONLY_ROLES.includes(role);
}

function mapPatientDbError(message: string): string {
  if (message.includes("insurance_plan")) {
    return "Falta actualizar la base de datos (columna insurance_plan). En Supabase → SQL Editor ejecutá supabase/migrations/041_patients_insurance_plan.sql y volvé a intentar.";
  }
  return message;
}

export async function createPatient(formData: FormData) {
  const access = await requireClinicPermission("managePatients");
  if (!access.ok) return { error: access.error };
  const { clinicId, role, isSuperadmin } = access;

  const raw = Object.fromEntries(formData.entries());
  const adminOnly = isAdminOnlyRole(role, isSuperadmin);
  const parsed = adminOnly
    ? patientAdminSchema.safeParse(raw)
    : patientSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  const { data: clinic } = await supabase
    .from("clinics")
    .select("default_insurance_provider, accepted_coverages")
    .eq("id", clinicId)
    .single();

  const insuranceProvider =
    parsed.data.insurance_provider?.trim() ||
    clinic?.default_insurance_provider ||
    null;

  const sanitized = sanitizePatientFields(parsed.data as Parameters<typeof sanitizePatientFields>[0]);

  const { data, error } = adminOnly
    ? await supabase
        .from("patients")
        .insert({
          clinic_id: clinicId,
          first_name: sanitized.first_name,
          last_name: sanitized.last_name,
          document_number: sanitized.document_number,
          birth_date: sanitized.birth_date || null,
          phone: sanitized.phone || null,
          email: sanitized.email || null,
          address: sanitized.address || null,
          insurance_provider: insuranceProvider,
          insurance_plan: (raw.insurance_plan as string) || null,
          insurance_number: sanitized.insurance_number || null,
          emergency_contact_name: sanitized.emergency_contact_name || null,
          emergency_contact_phone: sanitized.emergency_contact_phone || null,
        })
        .select()
        .single()
    : await supabase
        .from("patients")
        .insert({
          clinic_id: clinicId,
          first_name: sanitized.first_name,
          last_name: sanitized.last_name,
          document_number: sanitized.document_number,
          birth_date: sanitized.birth_date || null,
          phone: sanitized.phone || null,
          email: sanitized.email || null,
          address: sanitized.address || null,
          insurance_provider: insuranceProvider,
          insurance_plan: (raw.insurance_plan as string) || null,
          insurance_number: sanitized.insurance_number || null,
          emergency_contact_name: sanitized.emergency_contact_name || null,
          emergency_contact_phone: sanitized.emergency_contact_phone || null,
        })
        .select()
        .single();

  if (error) return { error: mapPatientDbError(error.message) };

  if (!adminOnly && data) {
    const profileFields = extractClinicalProfileFields(sanitized);
    const profileResult = await upsertPatientClinicalProfile(
      supabase,
      data.id,
      clinicId,
      profileFields
    );
    if (profileResult.error) return { error: profileResult.error };
  }

  await logAudit({
    clinicId,
    module: "patients",
    what: "Creó ficha de paciente",
    entityType: "patient",
    entityId: data.id,
    patientId: data.id,
    action: "create",
    newValues: data as unknown as Record<string, unknown>,
  });

  revalidatePath("/pacientes");
  return { data };
}

export async function updatePatient(id: string, formData: FormData) {
  const access = await requireClinicPermission("managePatients");
  if (!access.ok) return { error: access.error };
  const { clinicId, role, isSuperadmin } = access;

  const raw = Object.fromEntries(formData.entries());
  const adminOnly = isAdminOnlyRole(role, isSuperadmin);
  const parsed = adminOnly
    ? patientAdminSchema.safeParse(raw)
    : patientSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const sanitized = sanitizePatientFields(parsed.data as Parameters<typeof sanitizePatientFields>[0]);

  const supabase = await createClient();

  const { data: oldPatient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .single();

  if (!oldPatient) return { error: "Paciente no encontrado" };

  if (adminOnly) {
    const { error } = await supabase
      .from("patients")
      .update({
        first_name: sanitized.first_name,
        last_name: sanitized.last_name,
        document_number: sanitized.document_number,
        birth_date: sanitized.birth_date || null,
        phone: sanitized.phone || null,
        email: sanitized.email || null,
        address: sanitized.address || null,
        insurance_provider: sanitized.insurance_provider || null,
        insurance_plan: (raw.insurance_plan as string) || null,
        insurance_number: sanitized.insurance_number || null,
        emergency_contact_name: sanitized.emergency_contact_name || null,
        emergency_contact_phone: sanitized.emergency_contact_phone || null,
      })
      .eq("id", id)
      .eq("clinic_id", clinicId);
    if (error) return { error: mapPatientDbError(error.message) };
  } else {
    const { error } = await supabase
      .from("patients")
      .update({
        first_name: sanitized.first_name,
        last_name: sanitized.last_name,
        document_number: sanitized.document_number,
        phone: sanitized.phone || null,
        email: sanitized.email || null,
        address: sanitized.address || null,
        insurance_provider: sanitized.insurance_provider || null,
        insurance_plan: (raw.insurance_plan as string) || null,
        insurance_number: sanitized.insurance_number || null,
        emergency_contact_name: sanitized.emergency_contact_name || null,
        emergency_contact_phone: sanitized.emergency_contact_phone || null,
        birth_date: sanitized.birth_date || null,
      })
      .eq("id", id)
      .eq("clinic_id", clinicId);
    if (error) return { error: mapPatientDbError(error.message) };

    const profileResult = await upsertPatientClinicalProfile(
      supabase,
      id,
      clinicId,
      extractClinicalProfileFields(sanitized)
    );
    if (profileResult.error) return { error: profileResult.error };
  }

  const { data: updatedPatient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .single();

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

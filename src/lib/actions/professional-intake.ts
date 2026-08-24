"use server";

import { revalidatePath } from "next/cache";

import { requireStaffManagerWithClinicId } from "@/core/actions/guard-adapters";
import {
  revalidateClinicLocationsCache,
  revalidateClinicProfessionalsCache,
  revalidateClinicSpecialtiesCache,
} from "@/core/cache/revalidate-clinic-cache";
import { FEATURES } from "@/core/entitlements/features";
import { assertClinicSeatCapacity } from "@/core/entitlements/limits.server";
import { createClient } from "@/core/supabase/server";
import { firstZodIssue, parseEntityId } from "@/core/validations/params";
import {
  parseProfessionalBankForm,
  professionalBankFormSchema,
} from "@/core/validations/professional-bank";
import {
  parseProfessionalIntakeForm,
  professionalIntakeFormSchema,
  resolveIntakeSpecialtyName,
} from "@/core/validations/professional-intake";
import { agendaRuleSchema } from "@/core/validations/settings-schemas";

import {
  MEDICAL_SPECIALTIES,
  SPECIALTY_OTHER_VALUE,
} from "@/lib/constants/medical-specialties";
import type { AgendaRuleDraft } from "@/lib/constants/professional-intake-checklist";

async function requireStaffManager() {
  return requireStaffManagerWithClinicId({
    deniedMessage: "Sin permisos para ingreso de profesionales",
  });
}

function parseAgendaRules(raw: string): AgendaRuleDraft[] {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => agendaRuleSchema.safeParse(item))
      .filter((r) => r.success)
      .map((r) => r.data);
  } catch {
    return [];
  }
}

function validateIntakeForm(formData: FormData) {
  const raw = parseProfessionalIntakeForm(formData);
  const parsed = professionalIntakeFormSchema.safeParse(raw);
  if (!parsed.success) return { error: firstZodIssue(parsed.error) } as const;

  let specialtyName: string;
  try {
    specialtyName = resolveIntakeSpecialtyName(parsed.data);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Especialidad inválida",
    } as const;
  }

  if (
    parsed.data.specialtySelect === SPECIALTY_OTHER_VALUE &&
    !MEDICAL_SPECIALTIES.includes(specialtyName as (typeof MEDICAL_SPECIALTIES)[number]) &&
    specialtyName.length < 3
  ) {
    return { error: "Especialidad manual demasiado corta." } as const;
  }

  const agendaRules = parseAgendaRules(String(formData.get("agenda_rules_json") ?? ""));
  return { data: parsed.data, specialtyName, agendaRules } as const;
}

export async function submitProfessionalIntake(formData: FormData) {
  const access = await requireStaffManager();
  if (!access.ok) return { error: access.error };

  const seat = await assertClinicSeatCapacity({
    clinicId: access.clinicId,
    featureKey: FEATURES.PROFESSIONALS_MAX,
  });
  if (!seat.ok) return { error: seat.error };

  const validated = validateIntakeForm(formData);
  if ("error" in validated) return { error: validated.error };

  const { data, specialtyName, agendaRules } = validated;
  const displayName = `${data.doctorLastName}, ${data.doctorFirstName}`;
  const licenseProv = data.licenseProvincial || data.licenseNational;

  const supabase = await createClient();
  const clinicId = access.clinicId;

  let specialtyId: string | null = null;
  const { data: existingSpec } = await supabase
    .from("specialties")
    .select("id")
    .eq("clinic_id", clinicId)
    .ilike("name", specialtyName)
    .maybeSingle();

  if (existingSpec?.id) {
    specialtyId = existingSpec.id;
  } else {
    const { data: createdSpec, error: specErr } = await supabase
      .from("specialties")
      .insert({ clinic_id: clinicId, name: specialtyName })
      .select("id")
      .single();
    if (specErr) return { error: specErr.message };
    specialtyId = createdSpec.id;
  }

  let resolvedLocationId = data.location_id;
  if (!resolvedLocationId && data.officeAddress) {
    const { data: loc, error: locErr } = await supabase
      .from("locations")
      .insert({
        clinic_id: clinicId,
        name: `Consultorio ${data.doctorLastName}`,
        address: data.officeAddress,
      })
      .select("id")
      .single();
    if (locErr) return { error: locErr.message };
    resolvedLocationId = loc.id;
  }

  const { data: professional, error: proErr } = await supabase
    .from("professionals")
    .insert({
      clinic_id: clinicId,
      specialty_id: specialtyId,
      location_id: resolvedLocationId,
      display_name: displayName,
      license_number: licenseProv,
      license_national: data.licenseNational,
      license_provincial: licenseProv,
      document_number: data.documentNumber,
      email: data.email || null,
      phone: data.phone,
      office_phone: data.officePhone || null,
      office_address: data.officeAddress || null,
      accepted_insurances: data.acceptedInsurances || null,
      intake_notes: data.intakeNotes || null,
      intake_completed_at: new Date().toISOString(),
      is_active: true,
    })
    .select("id")
    .single();

  if (proErr) return { error: proErr.message };

  if (agendaRules.length > 0) {
    const rows = agendaRules.map((rule) => ({
      clinic_id: clinicId,
      professional_id: professional.id,
      location_id: resolvedLocationId,
      day_of_week: rule.day_of_week,
      start_time: rule.start_time,
      end_time: rule.end_time,
      slot_duration: rule.slot_duration,
      is_active: true,
    }));

    const { error: agendaErr } = await supabase.from("availability_rules").insert(rows);
    if (agendaErr) {
      return {
        error: `Profesional creado, pero falló la agenda: ${agendaErr.message}`,
        professionalId: professional.id,
      };
    }
  }

  revalidateClinicProfessionalsCache(clinicId);
  revalidateClinicSpecialtiesCache(clinicId);
  revalidateClinicLocationsCache(clinicId);
  revalidatePath("/ingreso-profesionales");
  revalidatePath("/configuracion");
  revalidatePath("/turnos/agenda");

  return {
    success: true as const,
    professionalId: professional.id,
    message: agendaRules.length
      ? "Profesional registrado con agenda inicial."
      : "Profesional registrado. Podés cargar la agenda después en Configuración.",
  };
}

export async function updateProfessionalProfile(professionalId: string, formData: FormData) {
  const access = await requireStaffManager();
  if (!access.ok) return { error: access.error };

  const idParsed = parseEntityId(professionalId, "Profesional");
  if (!idParsed.ok) return { error: idParsed.error };

  const validated = validateIntakeForm(formData);
  if ("error" in validated) return { error: validated.error };

  const { data, specialtyName } = validated;
  const displayName = `${data.doctorLastName}, ${data.doctorFirstName}`;
  const licenseProv = data.licenseProvincial || data.licenseNational;

  const supabase = await createClient();
  const clinicId = access.clinicId;

  let specialtyId: string | null = null;
  const { data: existingSpec } = await supabase
    .from("specialties")
    .select("id")
    .eq("clinic_id", clinicId)
    .ilike("name", specialtyName)
    .maybeSingle();

  if (existingSpec?.id) {
    specialtyId = existingSpec.id;
  } else {
    const { data: createdSpec, error: specErr } = await supabase
      .from("specialties")
      .insert({ clinic_id: clinicId, name: specialtyName })
      .select("id")
      .single();
    if (specErr) return { error: specErr.message };
    specialtyId = createdSpec.id;
  }

  let resolvedLocationId = data.location_id;
  if (!resolvedLocationId && data.officeAddress) {
    const { data: loc, error: locErr } = await supabase
      .from("locations")
      .insert({
        clinic_id: clinicId,
        name: `Consultorio ${data.doctorLastName}`,
        address: data.officeAddress,
      })
      .select("id")
      .single();
    if (locErr) return { error: locErr.message };
    resolvedLocationId = loc.id;
  }

  const { error } = await supabase
    .from("professionals")
    .update({
      specialty_id: specialtyId,
      location_id: resolvedLocationId,
      display_name: displayName,
      license_number: licenseProv,
      license_national: data.licenseNational,
      license_provincial: licenseProv,
      document_number: data.documentNumber,
      email: data.email || null,
      phone: data.phone,
      office_phone: data.officePhone || null,
      office_address: data.officeAddress || null,
      accepted_insurances: data.acceptedInsurances || null,
      intake_notes: data.intakeNotes || null,
      intake_completed_at: new Date().toISOString(),
    })
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };

  revalidateClinicProfessionalsCache(clinicId);
  revalidateClinicSpecialtiesCache(clinicId);
  revalidateClinicLocationsCache(clinicId);
  revalidatePath("/ingreso-profesionales");
  revalidatePath("/configuracion");
  revalidatePath("/turnos/agenda");

  return { success: true as const, message: "Datos del profesional actualizados." };
}

export async function updateProfessionalBankDetails(professionalId: string, formData: FormData) {
  const access = await requireStaffManager();
  if (!access.ok) return { error: access.error };

  const idParsed = parseEntityId(professionalId, "Profesional");
  if (!idParsed.ok) return { error: idParsed.error };

  const raw = parseProfessionalBankForm(formData);
  const parsed = professionalBankFormSchema.safeParse(raw);
  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const supabase = await createClient();
  const clinicId = access.clinicId;
  const data = parsed.data;

  const { error } = await supabase
    .from("professionals")
    .update({
      tax_id: data.taxId || null,
      iva_status: data.ivaStatus || null,
      bank_name: data.bankName || null,
      bank_account_type: data.bankAccountType || null,
      bank_account_number: data.bankAccountNumber || null,
      bank_cbu: data.bankCbu || null,
      bank_alias: data.bankAlias || null,
    })
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId);

  if (error) return { error: error.message };

  revalidateClinicProfessionalsCache(clinicId);
  revalidatePath("/ingreso-profesionales");

  return { success: true as const, message: "Datos bancarios actualizados." };
}

export async function saveProfessionalSchedule(professionalId: string, formData: FormData) {
  const access = await requireStaffManager();
  if (!access.ok) return { error: access.error };

  const idParsed = parseEntityId(professionalId, "Profesional");
  if (!idParsed.ok) return { error: idParsed.error };

  const agendaRules = parseAgendaRules(String(formData.get("agenda_rules_json") ?? ""));

  const supabase = await createClient();
  const clinicId = access.clinicId;

  const { data: pro } = await supabase
    .from("professionals")
    .select("location_id")
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!pro) return { error: "Profesional no encontrado." };

  const { error: delErr } = await supabase
    .from("availability_rules")
    .delete()
    .eq("professional_id", idParsed.data)
    .eq("clinic_id", clinicId);

  if (delErr) return { error: delErr.message };

  if (agendaRules.length > 0) {
    const rows = agendaRules.map((rule) => ({
      clinic_id: clinicId,
      professional_id: idParsed.data,
      location_id: pro.location_id,
      day_of_week: rule.day_of_week,
      start_time: rule.start_time,
      end_time: rule.end_time,
      slot_duration: rule.slot_duration,
      is_active: true,
    }));

    const { error: agendaErr } = await supabase.from("availability_rules").insert(rows);
    if (agendaErr) return { error: agendaErr.message };
  }

  revalidatePath("/ingreso-profesionales");
  revalidatePath("/configuracion");
  revalidatePath("/turnos/agenda");

  return {
    success: true as const,
    message: agendaRules.length
      ? "Horarios guardados correctamente."
      : "Horarios eliminados. El profesional no tendrá turnos hasta cargar rangos.",
  };
}

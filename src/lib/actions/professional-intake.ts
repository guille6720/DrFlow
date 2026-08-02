"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveClinic, getActiveClinicId } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/roles";
import {
  MEDICAL_SPECIALTIES,
  SPECIALTY_OTHER_VALUE,
} from "@/lib/constants/medical-specialties";
import type { AgendaRuleDraft } from "@/lib/constants/professional-intake-checklist";

const agendaRuleSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  slot_duration: z.number().int().min(10).max(120),
});

async function requireStaffManager() {
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  if (!clinicId || !hasPermission(role, "manageStaff", isSuperadmin)) {
    return { error: "Sin permisos para ingreso de profesionales" as const, clinicId: null };
  }
  return { clinicId, error: null as null };
}

function resolveSpecialtyName(formData: FormData): string {
  const select = String(formData.get("specialtySelect") ?? "").trim();
  const custom = String(formData.get("specialtyCustom") ?? "").trim();
  if (select === SPECIALTY_OTHER_VALUE) return custom;
  return select;
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

export async function submitProfessionalIntake(formData: FormData) {
  const access = await requireStaffManager();
  if (access.error || !access.clinicId) return { error: access.error };

  const firstName = String(formData.get("doctorFirstName") ?? "").trim();
  const lastName = String(formData.get("doctorLastName") ?? "").trim();
  const documentNumber = String(formData.get("documentNumber") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const licenseNational = String(formData.get("licenseNational") ?? "").trim();
  const licenseProvincial = String(formData.get("licenseProvincial") ?? "").trim();
  const officeAddress = String(formData.get("officeAddress") ?? "").trim();
  const officePhone = String(formData.get("officePhone") ?? "").trim();
  const acceptedInsurances = String(formData.get("acceptedInsurances") ?? "").trim();
  const intakeNotes = String(formData.get("intakeNotes") ?? "").trim();
  const locationId = String(formData.get("location_id") ?? "").trim() || null;
  const specialtyName = resolveSpecialtyName(formData);
  const agendaRules = parseAgendaRules(String(formData.get("agenda_rules_json") ?? ""));

  if (!firstName || !lastName) return { error: "Nombre y apellido son obligatorios." };
  if (!documentNumber) return { error: "DNI es obligatorio." };
  if (!phone) return { error: "Teléfono de contacto es obligatorio." };
  if (!licenseNational) return { error: "Matrícula nacional es obligatoria." };
  if (!specialtyName) return { error: "Seleccioná o escribí la especialidad." };
  if (
    formData.get("specialtySelect") === SPECIALTY_OTHER_VALUE &&
    !MEDICAL_SPECIALTIES.includes(specialtyName as (typeof MEDICAL_SPECIALTIES)[number]) &&
    specialtyName.length < 3
  ) {
    return { error: "Especialidad manual demasiado corta." };
  }

  const displayName = `${lastName}, ${firstName}`;
  const licenseProv = licenseProvincial || licenseNational;

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

  let resolvedLocationId = locationId;
  if (!resolvedLocationId && officeAddress) {
    const { data: loc, error: locErr } = await supabase
      .from("locations")
      .insert({
        clinic_id: clinicId,
        name: `Consultorio ${lastName}`,
        address: officeAddress,
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
      license_national: licenseNational,
      license_provincial: licenseProv,
      document_number: documentNumber,
      email: email || null,
      phone,
      office_phone: officePhone || null,
      office_address: officeAddress || null,
      accepted_insurances: acceptedInsurances || null,
      intake_notes: intakeNotes || null,
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

  revalidatePath("/ingreso-profesionales");
  revalidatePath("/configuracion");
  revalidatePath("/agenda");

  return {
    success: true as const,
    professionalId: professional.id,
    message: agendaRules.length
      ? "Profesional registrado con agenda inicial."
      : "Profesional registrado. Podés cargar la agenda después en Configuración.",
  };
}

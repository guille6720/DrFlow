"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveClinicId, getSession } from "@/lib/auth/session";
import {
  parseDoctorSetupFromForm,
  validateDoctorSetup,
} from "@/lib/validations/doctor-setup";
import { zodFieldErrors } from "@/lib/validations/form-errors";
import { MEDICAL_SPECIALTIES, SPECIALTY_OTHER_VALUE } from "@/lib/constants/medical-specialties";

export interface MyDoctorProfileData {
  doctorFirstName: string;
  doctorLastName: string;
  documentNumber: string;
  phone: string;
  email: string;
  specialtySelect: string;
  specialtyCustom: string;
  licenseNational: string;
  licenseProvincial: string;
  hasProfessional: boolean;
}

function splitFullName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function resolveSpecialtyFields(name: string | null | undefined): {
  specialtySelect: string;
  specialtyCustom: string;
} {
  if (!name) return { specialtySelect: "", specialtyCustom: "" };
  if ((MEDICAL_SPECIALTIES as readonly string[]).includes(name)) {
    return { specialtySelect: name, specialtyCustom: "" };
  }
  return { specialtySelect: SPECIALTY_OTHER_VALUE, specialtyCustom: name };
}

export async function loadMyDoctorProfile(): Promise<{
  data?: MyDoctorProfileData;
  error?: string;
}> {
  const user = await getSession();
  const clinicId = await getActiveClinicId();
  if (!user || !clinicId) return { error: "Tenés que iniciar sesión" };

  const supabase = await createClient();

  const [{ data: profile }, { data: professional }, { data: clinic }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone, document_number, email")
      .eq("id", user.id)
      .single(),
    supabase
      .from("professionals")
      .select("license_number, license_national, license_provincial, specialties(name)")
      .eq("user_id", user.id)
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase.from("clinics").select("phone").eq("id", clinicId).single(),
  ]);

  if (!profile) return { error: "No se encontró tu perfil" };

  const { first, last } = splitFullName(profile.full_name);
  const spec = professional?.specialties as { name: string } | { name: string }[] | null;
  const specialtyName = Array.isArray(spec) ? spec[0]?.name : spec?.name;
  const specialtyFields = resolveSpecialtyFields(specialtyName);

  return {
    data: {
      doctorFirstName: first,
      doctorLastName: last,
      documentNumber: profile.document_number ?? "",
      phone: clinic?.phone ?? profile.phone ?? "",
      email: profile.email,
      specialtySelect: specialtyFields.specialtySelect,
      specialtyCustom: specialtyFields.specialtyCustom,
      licenseNational: professional?.license_national ?? professional?.license_number ?? "",
      licenseProvincial: professional?.license_provincial ?? "",
      hasProfessional: Boolean(professional),
    },
  };
}

export async function updateMyDoctorProfile(formData: FormData) {
  const user = await getSession();
  const clinicId = await getActiveClinicId();
  if (!user || !clinicId) return { error: "Tenés que iniciar sesión" };

  const parsed = validateDoctorSetup(parseDoctorSetupFromForm(formData));
  if (parsed.fieldErrors) {
    return { error: "Revisá los campos marcados", fieldErrors: parsed.fieldErrors };
  }
  if (parsed.error) {
    return { error: "Datos inválidos", fieldErrors: zodFieldErrors(parsed.error) };
  }
  if (!parsed.data) return { error: "Datos incompletos" };

  const supabase = await createClient();

  const { error } = await supabase.rpc("update_my_doctor_profile", {
    p_clinic_id: clinicId,
    p_doctor_first_name: parsed.data.doctorFirstName,
    p_doctor_last_name: parsed.data.doctorLastName,
    p_document_number: parsed.data.documentNumber,
    p_phone: parsed.data.phone,
    p_specialty: parsed.data.specialty,
    p_license_national: parsed.data.licenseNational,
    p_license_provincial: parsed.data.licenseProvincial || parsed.data.licenseNational,
  });

  if (error) {
    if (error.message.includes("NOT_AUTHENTICATED")) {
      return { error: "Tenés que iniciar sesión" };
    }
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/configuracion");

  return { success: true };
}

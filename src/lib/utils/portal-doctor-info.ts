import { createClient } from "@/lib/supabase/server";
import {
  formatProfessionalLicenses,
  getProfessionalDisplayName,
} from "@/lib/utils/professional";
import type { DoctorShareInfo } from "@/lib/utils/doctor-share-info";

export type { DoctorShareInfo };

type RawProfessional = {
  display_name?: string | null;
  license_number?: string | null;
  license_national?: string | null;
  license_provincial?: string | null;
  specialties?: { name: string } | { name: string }[] | null;
  profiles?: { full_name?: string; phone?: string | null } | { full_name?: string; phone?: string | null }[] | null;
};

function normalizeProfessional(raw: RawProfessional | null | undefined) {
  if (!raw) return null;
  const profileRaw = raw.profiles;
  const profile = profileRaw
    ? Array.isArray(profileRaw)
      ? profileRaw[0]
      : profileRaw
    : null;
  return { ...raw, profiles: profile ?? null };
}

export async function resolvePortalDoctorInfo(slug: string): Promise<DoctorShareInfo | null> {
  const supabase = await createClient();

  const { data: link } = await supabase
    .from("public_booking_links")
    .select(
      `
      clinic_id,
      professional_id,
      clinics(name, phone),
      professionals(
        display_name,
        license_number,
        license_national,
        license_provincial,
        specialties(name),
        profiles(full_name, phone)
      )
    `
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (link) {
    const linkedClinic = link.clinics as unknown as
      | { name: string; phone: string | null }
      | { name: string; phone: string | null }[]
      | null;
    const clinic = linkedClinic
      ? Array.isArray(linkedClinic)
        ? linkedClinic[0]
        : linkedClinic
      : null;
    const linkedPro = link.professionals as unknown as
      | {
          display_name: string | null;
          license_number: string | null;
          license_national: string | null;
          license_provincial: string | null;
          specialties: { name: string } | { name: string }[] | null;
          profiles: { full_name: string; phone: string | null } | { full_name: string; phone: string | null }[] | null;
        }
      | {
          display_name: string | null;
          license_number: string | null;
          license_national: string | null;
          license_provincial: string | null;
          specialties: { name: string } | { name: string }[] | null;
          profiles: { full_name: string; phone: string | null } | { full_name: string; phone: string | null }[] | null;
        }[]
      | null;
    const professionalRaw = linkedPro
      ? Array.isArray(linkedPro)
        ? linkedPro[0]
        : linkedPro
      : null;
    const professional = normalizeProfessional(
      professionalRaw as RawProfessional | null | undefined
    );

    if (professional || clinic) {
      const spec = professional?.specialties;
      const specialtyName = Array.isArray(spec) ? spec[0]?.name : spec?.name;
      return {
        fullName: professional
          ? getProfessionalDisplayName(professional)
          : clinic?.name ?? "Consultorio",
        licenseLabel: professional ? formatProfessionalLicenses(professional) : null,
        specialty: specialtyName ?? null,
        phone: clinic?.phone ?? professional?.profiles?.phone ?? null,
        clinicName: clinic?.name ?? "Consultorio",
      };
    }
  }

  const { data: clinic } = await supabase
    .from("clinics")
    .select("id, name, phone")
    .eq("slug", slug)
    .maybeSingle();

  if (!clinic) return null;

  const { data: professional } = await supabase
    .from("professionals")
    .select(
      "display_name, license_number, license_national, license_provincial, specialties(name), profiles(full_name, phone)"
    )
    .eq("clinic_id", clinic.id)
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const pro = normalizeProfessional(professional as RawProfessional | null | undefined);
  const spec = pro?.specialties;
  const specialtyName = Array.isArray(spec) ? spec[0]?.name : spec?.name;

  return {
    fullName: pro ? getProfessionalDisplayName(pro) : clinic.name,
    licenseLabel: pro ? formatProfessionalLicenses(pro) : null,
    specialty: specialtyName ?? null,
    phone: clinic.phone ?? pro?.profiles?.phone ?? null,
    clinicName: clinic.name,
  };
}

export async function getDoctorShareInfoForClinic(
  clinicId: string
): Promise<DoctorShareInfo | null> {
  const supabase = await createClient();

  const { data: link } = await supabase
    .from("public_booking_links")
    .select("slug")
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .maybeSingle();

  if (link?.slug) {
    return resolvePortalDoctorInfo(link.slug);
  }

  const { data: clinic } = await supabase
    .from("clinics")
    .select("slug, name, phone")
    .eq("id", clinicId)
    .single();

  if (clinic?.slug) {
    return resolvePortalDoctorInfo(clinic.slug);
  }

  return null;
}

export async function getPortalSlugForClinic(clinicId: string): Promise<string | null> {
  const supabase = await createClient();

  const [{ data: link }, { data: clinic }] = await Promise.all([
    supabase
      .from("public_booking_links")
      .select("slug")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase.from("clinics").select("slug").eq("id", clinicId).single(),
  ]);

  return link?.slug ?? clinic?.slug ?? null;
}

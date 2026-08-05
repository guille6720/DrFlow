import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/core/supabase/server";
import {
  formatProfessionalLicenses,
  getProfessionalDisplayName,
} from "@/lib/utils/professional";
import type { DoctorShareInfo } from "@/lib/utils/doctor-share-info";

export type { DoctorShareInfo };

export type PortalContext = {
  portalSlug: string | null;
  doctorInfo: DoctorShareInfo | null;
};

type RawProfessional = {
  display_name?: string | null;
  license_number?: string | null;
  license_national?: string | null;
  license_provincial?: string | null;
  specialties?: { name: string } | { name: string }[] | null;
  profiles?: { full_name?: string; phone?: string | null } | { full_name?: string; phone?: string | null }[] | null;
};

const BOOKING_LINK_DOCTOR_SELECT = `
  slug,
  clinic_id,
  clinics(name, phone),
  professionals(
    display_name,
    license_number,
    license_national,
    license_provincial,
    specialties(name),
    profiles(full_name, phone)
  )
`;

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

export function doctorInfoFromBookingLink(link: {
  clinics: unknown;
  professionals: unknown;
}): DoctorShareInfo | null {
  const linkedClinic = link.clinics as
    | { name: string; phone: string | null }
    | { name: string; phone: string | null }[]
    | null;
  const clinic = linkedClinic
    ? Array.isArray(linkedClinic)
      ? linkedClinic[0]
      : linkedClinic
    : null;
  const linkedPro = link.professionals as RawProfessional | RawProfessional[] | null;
  const professionalRaw = linkedPro
    ? Array.isArray(linkedPro)
      ? linkedPro[0]
      : linkedPro
    : null;
  const professional = normalizeProfessional(professionalRaw);

  if (!professional && !clinic) return null;

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

/** Slug + doctor info in one round-trip (avoids sequential portal waterfall). */
export async function getPortalContextForClinic(
  clinicId: string,
  supabase?: SupabaseClient
): Promise<PortalContext> {
  const client = supabase ?? (await createClient());

  const { data: link } = await client
    .from("public_booking_links")
    .select(BOOKING_LINK_DOCTOR_SELECT)
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .maybeSingle();

  if (link?.slug) {
    return {
      portalSlug: link.slug,
      doctorInfo: doctorInfoFromBookingLink(link),
    };
  }

  const { data: clinic } = await client
    .from("clinics")
    .select("slug, name, phone")
    .eq("id", clinicId)
    .single();

  const portalSlug = clinic?.slug ?? null;
  if (!portalSlug) {
    return { portalSlug: null, doctorInfo: null };
  }

  if (clinic) {
    return {
      portalSlug,
      doctorInfo: {
        fullName: clinic.name,
        licenseLabel: null,
        specialty: null,
        phone: clinic.phone ?? null,
        clinicName: clinic.name,
      },
    };
  }

  return { portalSlug, doctorInfo: await resolvePortalDoctorInfo(portalSlug) };
}

export async function resolvePortalDoctorInfo(slug: string): Promise<DoctorShareInfo | null> {
  const supabase = await createClient();

  const { data: link } = await supabase
    .from("public_booking_links")
    .select(BOOKING_LINK_DOCTOR_SELECT)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (link) {
    const info = doctorInfoFromBookingLink(link);
    if (info) return info;
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

/** @deprecated Prefer getPortalContextForClinic */
export async function getDoctorShareInfoForClinic(
  clinicId: string
): Promise<DoctorShareInfo | null> {
  const ctx = await getPortalContextForClinic(clinicId);
  return ctx.doctorInfo;
}

/** @deprecated Prefer getPortalContextForClinic */
export async function getPortalSlugForClinic(clinicId: string): Promise<string | null> {
  const ctx = await getPortalContextForClinic(clinicId);
  return ctx.portalSlug;
}

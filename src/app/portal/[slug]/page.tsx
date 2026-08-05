import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createClient } from "@/core/supabase/server";

import { PatientPortalView } from "@/features/portal/components/portal/patient-portal-view";

import { clinicOffersPami } from "@/lib/constants/coverages";
import {
  doctorInfoFromBookingLink,
  resolvePortalDoctorInfo,
} from "@/lib/utils/portal-doctor-info";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `App pacientes — ${slug} | DrFlow`,
    description: "Pedí turno, recetas y contactá a tu consultorio por WhatsApp.",
  };
}

async function loadClinicPamiFlags(clinicId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clinics")
    .select("accepted_coverages, practice_profile")
    .eq("id", clinicId)
    .maybeSingle();

  return clinicOffersPami(data?.accepted_coverages ?? null, data?.practice_profile ?? null);
}

export default async function PatientPortalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: link } = await supabase
    .from("public_booking_links")
    .select(
      "slug, clinic_id, clinics(id, name, phone, address, slug, accepted_coverages, practice_profile), professionals(display_name, license_number, license_national, license_provincial, specialties(name), profiles(full_name, phone))"
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  const doctor = link
    ? (doctorInfoFromBookingLink(link) ?? (await resolvePortalDoctorInfo(slug)))
    : await resolvePortalDoctorInfo(slug);

  if (!link) {
    const { data: clinic } = await supabase
      .from("clinics")
      .select("id, name, phone, address, slug, accepted_coverages, practice_profile")
      .eq("slug", slug)
      .single();

    if (!clinic) notFound();

    const { data: professionals } = await supabase
      .from("professionals")
      .select("id, display_name, license_number, bio, specialties(name)")
      .eq("clinic_id", clinic.id)
      .eq("is_active", true)
      .order("display_name");

    const offersPami = clinicOffersPami(
      clinic.accepted_coverages ?? null,
      clinic.practice_profile ?? null
    );

    return (
      <PatientPortalView
        slug={slug}
        clinicName={clinic.name}
        clinicPhone={clinic.phone}
        clinicAddress={clinic.address}
        professionals={professionals ?? []}
        doctor={doctor}
        offersPami={offersPami}
      />
    );
  }

  const clinic = (Array.isArray(link.clinics) ? link.clinics[0] : link.clinics) as {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    slug: string;
    accepted_coverages?: string[] | null;
    practice_profile?: string | null;
  } | null;

  const { data: professionals } = await supabase
    .from("professionals")
    .select("id, display_name, license_number, bio, specialties(name)")
    .eq("clinic_id", link.clinic_id)
    .eq("is_active", true)
    .order("display_name");

  const offersPami = clinic
    ? clinicOffersPami(clinic.accepted_coverages ?? null, clinic.practice_profile ?? null)
    : await loadClinicPamiFlags(link.clinic_id);

  return (
    <PatientPortalView
      slug={slug}
      clinicName={clinic?.name ?? "Consultorio"}
      clinicPhone={clinic?.phone ?? null}
      clinicAddress={clinic?.address ?? null}
      professionals={professionals ?? []}
      doctor={doctor}
      offersPami={offersPami}
    />
  );
}

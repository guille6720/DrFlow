import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PatientPortalView } from "@/components/portal/patient-portal-view";
import { notFound } from "next/navigation";
import { resolvePortalDoctorInfo } from "@/lib/utils/portal-doctor-info";

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

export default async function PatientPortalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const doctor = await resolvePortalDoctorInfo(slug);

  const { data: link } = await supabase
    .from("public_booking_links")
    .select("*, clinics(id, name, phone, address, slug)")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!link) {
    const { data: clinic } = await supabase
      .from("clinics")
      .select("id, name, phone, address, slug")
      .eq("slug", slug)
      .single();

    if (!clinic) notFound();

    const { data: professionals } = await supabase
      .from("professionals")
      .select("id, display_name, license_number, bio, specialties(name)")
      .eq("clinic_id", clinic.id)
      .eq("is_active", true)
      .order("display_name");

    return (
      <PatientPortalView
        slug={slug}
        clinicName={clinic.name}
        clinicPhone={clinic.phone}
        clinicAddress={clinic.address}
        professionals={professionals ?? []}
        doctor={doctor}
      />
    );
  }

  const clinic = link.clinics as {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    slug: string;
  } | null;

  const { data: professionals } = await supabase
    .from("professionals")
    .select("id, display_name, license_number, bio, specialties(name)")
    .eq("clinic_id", link.clinic_id)
    .eq("is_active", true)
    .order("display_name");

  return (
    <PatientPortalView
      slug={slug}
      clinicName={clinic?.name ?? "Consultorio"}
      clinicPhone={clinic?.phone ?? null}
      clinicAddress={clinic?.address ?? null}
      professionals={professionals ?? []}
      doctor={doctor}
    />
  );
}

import { PatientAppInstallView } from "@/features/portal/components/portal/patient-app-install-view";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  buildPatientAppOgDescription,
  PATIENT_PWA_ICON_512,
} from "@/features/pacientes/utils/patient-portal-ready";
import { resolvePortalDoctorInfo } from "@/lib/utils/portal-doctor-info";
import { getSiteUrl } from "@/core/supabase/env";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doctor = await resolvePortalDoctorInfo(slug);
  if (!doctor) {
    return { title: "Instalar app | DrFlow" };
  }

  const origin = getSiteUrl();
  const ogImage = `${origin}${PATIENT_PWA_ICON_512}`;
  const title = `${doctor.fullName}${doctor.licenseLabel ? ` — ${doctor.licenseLabel}` : ""}`;
  const description = buildPatientAppOgDescription(doctor);

  return {
    title: `Instalar app — ${doctor.fullName}`,
    description,
    openGraph: {
      type: "website",
      locale: "es_AR",
      url: `${origin}/portal/${slug}/instalar`,
      siteName: "DrFlow",
      title,
      description,
      images: [
        {
          url: ogImage,
          width: 512,
          height: 512,
          alt: "DrFlow — App verde para pacientes",
        },
      ],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function PatientAppInstallPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doctor = await resolvePortalDoctorInfo(slug);
  if (!doctor) notFound();

  return <PatientAppInstallView slug={slug} clinicName={doctor.clinicName} doctor={doctor} />;
}

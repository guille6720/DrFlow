import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isPublicPortalAllowedForSlug } from "@/core/entitlements/public-portal.server";
import { getSiteUrl } from "@/core/supabase/env";

import {
  buildPatientAppOgDescription,
  PATIENT_PWA_ICON_512,
} from "@/features/pacientes/utils/patient-portal-ready";
import { PatientAppInstallView } from "@/features/portal/components/portal/patient-app-install-view";

import { resolvePortalDoctorInfo } from "@/lib/utils/portal-doctor-info";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!(await isPublicPortalAllowedForSlug(slug))) {
    return { title: "Instalar app | NexClinic" };
  }
  const doctor = await resolvePortalDoctorInfo(slug);
  if (!doctor) {
    return { title: "Instalar app | NexClinic" };
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
      siteName: "NexClinic",
      title,
      description,
      images: [
        {
          url: ogImage,
          width: 512,
          height: 512,
          alt: "NexClinic — App verde para pacientes",
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
  if (!(await isPublicPortalAllowedForSlug(slug))) notFound();
  const doctor = await resolvePortalDoctorInfo(slug);
  if (!doctor) notFound();

  return <PatientAppInstallView slug={slug} clinicName={doctor.clinicName} doctor={doctor} />;
}

import { createClient } from "@/lib/supabase/server";
import { PatientAppInstallView } from "@/components/portal/patient-app-install-view";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PWA_APPLE_ICON } from "@/lib/utils/patient-portal-ready";
import {
  buildPatientAppOgDescription,
} from "@/lib/utils/patient-portal-ready";
import { resolvePortalDoctorInfo } from "@/lib/utils/portal-doctor-info";
import { getSiteUrl } from "@/lib/supabase/env";

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
  const ogImage = `${origin}/icon-512.png`;
  const title = `${doctor.fullName}${doctor.licenseLabel ? ` — ${doctor.licenseLabel}` : ""}`;
  const description = buildPatientAppOgDescription(doctor);

  return {
    title: `Instalar app — ${doctor.fullName}`,
    description,
    manifest: `/portal/${slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: doctor.clinicName, statusBarStyle: "default" },
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
          alt: "DrFlow — App para pacientes",
        },
      ],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [ogImage],
    },
    icons: {
      icon: [
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: PWA_APPLE_ICON, sizes: "192x192", type: "image/png" }],
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

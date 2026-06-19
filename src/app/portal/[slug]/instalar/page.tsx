import { createClient } from "@/lib/supabase/server";
import { PatientAppInstallView } from "@/components/portal/patient-app-install-view";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PWA_APPLE_ICON } from "@/lib/utils/patient-portal-ready";

async function resolveClinicName(slug: string): Promise<string | null> {
  const supabase = await createClient();

  const { data: link } = await supabase
    .from("public_booking_links")
    .select("clinics(name)")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  const linkedClinic = link?.clinics as { name: string } | { name: string }[] | null;
  if (linkedClinic) {
    return Array.isArray(linkedClinic) ? linkedClinic[0]?.name ?? null : linkedClinic.name;
  }

  const { data: clinic } = await supabase
    .from("clinics")
    .select("name")
    .eq("slug", slug)
    .maybeSingle();

  return clinic?.name ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const clinicName = (await resolveClinicName(slug)) ?? "Consultorio";

  return {
    title: `Instalar app — ${clinicName}`,
    description: "Agregá la app del consultorio a tu celular para turnos y recetas PAMI.",
    manifest: `/portal/${slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: clinicName, statusBarStyle: "default" },
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
  const clinicName = await resolveClinicName(slug);
  if (!clinicName) notFound();

  return <PatientAppInstallView slug={slug} clinicName={clinicName} />;
}

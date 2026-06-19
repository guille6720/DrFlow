import type { Metadata } from "next";
import { PortalPwaRegister } from "@/components/pwa/portal-pwa-register";
import {
  PATIENT_PWA_METADATA_ICONS,
  PATIENT_THEME_COLOR,
} from "@/lib/utils/patient-portal-ready";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    manifest: `/portal/${slug}/manifest.webmanifest`,
    themeColor: PATIENT_THEME_COLOR,
    appleWebApp: { capable: true, statusBarStyle: "default" },
    icons: PATIENT_PWA_METADATA_ICONS,
  };
}

export default function PortalSlugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PortalPwaRegister />
      {children}
    </>
  );
}

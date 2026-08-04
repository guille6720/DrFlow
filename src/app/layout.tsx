import type { Metadata } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { getPublicSiteUrl } from "@/core/supabase/env";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { PWA_APPLE_ICON } from "@/features/pacientes/utils/patient-portal-ready";
import { UiThemeBootstrapScript } from "@/core/components/theme/ui-theme-bootstrap-script";

const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "DrFlow — Gestión clínica para consultorios argentinos",
    template: "%s | DrFlow",
  },
  description:
    "Agenda, pacientes, historia clínica, recetas y guía farmacológica por síntomas. Diseñado para médicos que quieren fluir, no luchar con el software.",
  applicationName: "DrFlow",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: PWA_APPLE_ICON, sizes: "192x192", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: siteUrl,
    siteName: "DrFlow",
    title: "DrFlow — Gestión clínica para consultorios argentinos",
    description:
      "Agenda, historia clínica, recetas y app para pacientes. Pensado para médicos en Argentina.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "DrFlow",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DrFlow — Gestión clínica para consultorios",
    description: "Agenda, historia clínica, recetas y app para pacientes.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      data-ui-style="1"
      className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <UiThemeBootstrapScript />
        {children}
      </body>
    </html>
  );
}

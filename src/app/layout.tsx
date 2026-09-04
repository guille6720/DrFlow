import "./globals.css";

import type { Metadata } from "next";
import type { Viewport } from "next";

import {
  BRAND_NAME,
  BRAND_OG_DESCRIPTION,
  BRAND_SEO_DESCRIPTION,
  BRAND_SEO_TITLE,
} from "@/core/brand/brand";
import { ToastProvider } from "@/core/components/notifications/toast-provider";
import { SentryInit } from "@/core/components/observability/sentry-init";
import { UiThemeBootstrapScript } from "@/core/components/theme/ui-theme-bootstrap-script";
import { getPublicSiteUrl } from "@/core/supabase/env";

import { PWA_APPLE_ICON } from "@/features/pacientes/utils/patient-portal-ready";

const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: BRAND_SEO_TITLE,
    template: `%s | ${BRAND_NAME}`,
  },
  description: BRAND_SEO_DESCRIPTION,
  applicationName: BRAND_NAME,
  appleWebApp: {
    title: BRAND_NAME,
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: PWA_APPLE_ICON, sizes: "192x192", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: siteUrl,
    siteName: BRAND_NAME,
    title: BRAND_SEO_TITLE,
    description: BRAND_OG_DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: BRAND_NAME,
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND_SEO_TITLE,
    description: BRAND_SEO_DESCRIPTION,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    canonical: "/",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0B1F3A" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1F3A" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      data-ui-style="2"
      data-ui-palette="clinical-blue"
      data-clinical-dark="0"
      className="h-full antialiased"
    >
      <body className="min-h-full">
        <UiThemeBootstrapScript />
        <SentryInit />
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}

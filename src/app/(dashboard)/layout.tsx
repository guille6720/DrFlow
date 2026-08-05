import type { Metadata } from "next";
import { Suspense } from "react";

import { DashboardDataShell } from "@/core/components/layout/dashboard-data-shell";

import { PWA_APPLE_ICON } from "@/features/pacientes/utils/patient-portal-ready";

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "DrFlow",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: PWA_APPLE_ICON, sizes: "192x192", type: "image/png" }],
  },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center drflow-mesh">
          <p className="text-sm text-slate-500">Cargando panel…</p>
        </div>
      }
    >
      <DashboardDataShell>{children}</DashboardDataShell>
    </Suspense>
  );
}

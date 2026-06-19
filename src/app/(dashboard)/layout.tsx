import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { ClinicalTopNav } from "@/components/layout/clinical-top-nav";
import { FloatingActions } from "@/components/layout/floating-actions";
import { RoutePrefetcher } from "@/components/layout/route-prefetcher";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { getDashboardShell } from "@/lib/auth/session";

import type { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "DrFlow",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icon-512.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/icon-512.png", sizes: "512x512", type: "image/png" }],
  },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, clinics, clinicId, clinic, role, isSuperadmin } =
    await getDashboardShell();

  if (!profile) redirect("/login");
  if (clinics.length === 0 && !isSuperadmin) redirect("/onboarding");

  return (
    <div className="min-h-screen drflow-mesh">
      <PwaRegister />
      <RoutePrefetcher />
      <Sidebar
        clinicName={clinic?.name}
        role={role}
        isSuperadmin={isSuperadmin}
      />
      <main className="lg:pl-64">
        <Suspense fallback={null}>
          <ClinicalTopNav />
        </Suspense>
        {children}
      </main>
      <FloatingActions />
    </div>
  );
}

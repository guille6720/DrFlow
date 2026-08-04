import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Suspense } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { DashboardSidebarProvider } from "@/components/layout/dashboard-sidebar-context";
import { DashboardMain } from "@/components/layout/dashboard-main";
import { DashboardSidebarReveal } from "@/components/layout/dashboard-sidebar-reveal";
import { ClinicalTopNav } from "@/components/layout/clinical-top-nav";
import { FloatingActions } from "@/components/layout/floating-actions";
import { CommandPaletteProvider } from "@/components/command-palette/command-palette-provider";
import { RoutePrefetcher } from "@/components/layout/route-prefetcher";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { UpdateBanner } from "@/components/updates/update-banner";
import { TrialBanner } from "@/components/trial/trial-banner";
import { UiThemeProvider } from "@/components/theme/ui-theme-provider";
import { VoiceInputProvider } from "@/features/voice";
import { getDashboardShell, logAudit } from "@/lib/auth/session";
import { canAccessRoute } from "@/lib/permissions/roles";
import { createClient } from "@/lib/supabase/server";
import { loadClinicFeatures } from "@/lib/server/load-clinic-feature-flags";
import { resolveClinicPlugins, isRouteAllowedByPlugins } from "@/plugins/resolve";
import { resolveClinicFeatureFlags } from "@/lib/features/flags/resolve";
import { ClinicFeaturesProvider } from "@/components/plugins/clinic-plugins-provider";
import { SkipToContent } from "@/components/accessibility/skip-to-content";
import { AccessibilityProvider } from "@/components/accessibility/accessibility-provider";
import { RouteAnnouncer } from "@/components/accessibility/route-announcer";
import {
  isClinicTrialExpired,
  isTrialWhitelistedPath,
  trialDaysRemaining,
} from "@/lib/trial/clinic-trial";

import type { Metadata } from "next";

import { PWA_APPLE_ICON } from "@/lib/utils/patient-portal-ready";

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

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, clinics, clinicId, clinic, role, isSuperadmin } =
    await getDashboardShell();

  if (!profile) redirect("/login");
  if (clinics.length === 0 && !isSuperadmin) redirect("/onboarding");

  const path = (await headers()).get("x-drflow-path") ?? "";

  const supabase = await createClient();
  const clinicFeatures = clinicId
    ? await loadClinicFeatures(supabase, clinicId)
    : {
        plugins: resolveClinicPlugins([]),
        flags: resolveClinicFeatureFlags([]),
      };

  if (path && !canAccessRoute(role, path, isSuperadmin)) {
    await logAudit({
      clinicId: clinicId ?? undefined,
      entityType: "route_access",
      action: "view",
      metadata: { path, reason: "rbac_denied" },
    });
    redirect("/dashboard");
  }

  if (path && clinicId && !isRouteAllowedByPlugins(path, clinicFeatures.plugins)) {
    await logAudit({
      clinicId,
      entityType: "route_access",
      action: "view",
      metadata: { path, reason: "plugin_disabled" },
    });
    redirect("/dashboard");
  }

  if (
    !isSuperadmin &&
    clinic &&
    isClinicTrialExpired(clinic) &&
    path &&
    !isTrialWhitelistedPath(path)
  ) {
    await logAudit({
      clinicId: clinicId ?? undefined,
      entityType: "subscription",
      action: "view",
      metadata: { path, reason: "trial_expired" },
    });
    redirect("/trial-expirado");
  }

  const daysLeft = clinic?.trial_ends_at ? trialDaysRemaining(clinic.trial_ends_at) : null;
  const showTrialBanner =
    !isSuperadmin &&
    daysLeft !== null &&
    daysLeft > 0 &&
    daysLeft <= 7 &&
    path !== "/trial-expirado";

  return (
    <div className="min-h-screen drflow-mesh">
      <PwaRegister />
      <RoutePrefetcher />
      <UpdateBanner />
      {showTrialBanner && clinic?.trial_ends_at && (
        <TrialBanner trialEndsAt={clinic.trial_ends_at} daysRemaining={daysLeft} />
      )}
      <DashboardSidebarProvider>
        <ClinicFeaturesProvider
          plugins={clinicFeatures.plugins}
          flags={clinicFeatures.flags}
        >
        <CommandPaletteProvider
          role={role}
          isSuperadmin={isSuperadmin}
          enabled={clinicFeatures.flags.command_palette}
        >
        <AccessibilityProvider>
        <UiThemeProvider>
        <VoiceInputProvider
          clinicVoiceInputEnabled={
            clinic?.voice_input_enabled !== false && clinicFeatures.plugins.voice
          }
        >
        <SkipToContent />
        <RouteAnnouncer />
        <Sidebar
          clinicName={clinic?.name}
          role={role}
          isSuperadmin={isSuperadmin}
        />
        <DashboardSidebarReveal />
        <DashboardMain>
          <Suspense fallback={null}>
            <ClinicalTopNav />
          </Suspense>
          {children}
        </DashboardMain>
        <FloatingActions />
        </VoiceInputProvider>
        </UiThemeProvider>
        </AccessibilityProvider>
        </CommandPaletteProvider>
        </ClinicFeaturesProvider>
      </DashboardSidebarProvider>
    </div>
  );
}

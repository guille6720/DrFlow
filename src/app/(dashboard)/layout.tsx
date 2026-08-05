import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Suspense } from "react";
import { Sidebar } from "@/core/components/layout/sidebar";
import { DashboardSidebarProvider } from "@/core/components/layout/dashboard-sidebar-context";
import { DashboardMain } from "@/core/components/layout/dashboard-main";
import { DashboardSidebarReveal } from "@/core/components/layout/dashboard-sidebar-reveal";
import { ClinicalTopNav } from "@/core/components/layout/clinical-top-nav";
import { FloatingActions } from "@/core/components/layout/floating-actions";
import { CommandPaletteProvider } from "@/core/components/command-palette/command-palette-provider";
import { RoutePrefetcher } from "@/core/components/layout/route-prefetcher";
import { PwaRegister } from "@/core/components/pwa/pwa-register";
import { UpdateBanner } from "@/core/components/updates/update-banner";
import { TrialBanner } from "@/core/components/trial/trial-banner";
import { UiThemeProvider } from "@/core/components/theme/ui-theme-provider";
import { VoiceInputProvider } from "@/features/voice";
import { getDashboardShell, logAudit } from "@/core/auth/session";
import { canAccessRoute } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";
import { loadClinicFeatures } from "@/lib/server/load-clinic-feature-flags";
import { resolveClinicPlugins, isRouteAllowedByPlugins } from "@/plugins/resolve";
import { resolveClinicFeatureFlags } from "@/features/flags/lib/resolve";
import { ClinicFeaturesProvider } from "@/features/plugins/components/plugins/clinic-plugins-provider";
import { SkipToContent } from "@/core/components/accessibility/skip-to-content";
import { AccessibilityProvider } from "@/core/components/accessibility/accessibility-provider";
import { RouteAnnouncer } from "@/core/components/accessibility/route-announcer";
import {
  ClinicalContextMenuHost,
  ClinicalWorkflowShortcuts,
} from "@/features/ia/components/clinical-workflow";
import { ClinicalCopilotProvider } from "@/features/ia/components/clinical-workflow/clinical-copilot-context";
import { ClinicalCopilotHost } from "@/features/ia/components/clinical-workflow/clinical-copilot-host";
import { AdminOpsCopilotProvider } from "@/features/ia/components/admin-ops/admin-ops-copilot-context";
import { AdminOpsCopilotHost } from "@/features/ia/components/admin-ops/admin-ops-copilot-host";
import {
  isClinicTrialExpired,
  isTrialWhitelistedPath,
  trialDaysRemaining,
} from "@/core/trial/clinic-trial";

import type { Metadata } from "next";

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
        <ClinicalCopilotProvider>
        <AdminOpsCopilotProvider>
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
        <ClinicalContextMenuHost />
        <Suspense fallback={null}>
          <ClinicalWorkflowShortcuts />
        </Suspense>
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
        <ClinicalCopilotHost />
        <AdminOpsCopilotHost />
        </VoiceInputProvider>
        </UiThemeProvider>
        </AccessibilityProvider>
        </CommandPaletteProvider>
        </AdminOpsCopilotProvider>
        </ClinicalCopilotProvider>
        </ClinicFeaturesProvider>
      </DashboardSidebarProvider>
    </div>
  );
}

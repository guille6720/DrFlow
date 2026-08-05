import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getDashboardShell } from "@/core/auth/session";
import { logAudit } from "@/core/auth/session.actions";
import { AccessibilityProvider } from "@/core/components/accessibility/accessibility-provider";
import { RouteAnnouncer } from "@/core/components/accessibility/route-announcer";
import { SkipToContent } from "@/core/components/accessibility/skip-to-content";
import { CommandPaletteProvider } from "@/core/components/command-palette/command-palette-provider";
import { ClinicalTopNav } from "@/core/components/layout/clinical-top-nav";
import { DashboardMain } from "@/core/components/layout/dashboard-main";
import { DashboardSidebarProvider } from "@/core/components/layout/dashboard-sidebar-context";
import { DashboardSidebarReveal } from "@/core/components/layout/dashboard-sidebar-reveal";
import { LazyDashboardCopilotHosts } from "@/core/components/layout/lazy-dashboard-copilot-hosts";
import { LazyDashboardInteractionHosts } from "@/core/components/layout/lazy-dashboard-interaction-hosts";
import { Sidebar } from "@/core/components/layout/sidebar";
import { PerformanceMonitor } from "@/core/components/observability/performance-monitor";
import { PwaRegister } from "@/core/components/pwa/pwa-register";
import { UiThemeProvider } from "@/core/components/theme/ui-theme-provider";
import { TrialBanner } from "@/core/components/trial/trial-banner";
import { UpdateBanner } from "@/core/components/updates/update-banner";
import { canAccessRoute } from "@/core/permissions/roles";
import {
  isClinicTrialExpired,
  isTrialWhitelistedPath,
  trialDaysRemaining,
} from "@/core/trial/clinic-trial";

import { AdminOpsCopilotProvider } from "@/features/ia/components/admin-ops/admin-ops-copilot-context";
import { ClinicalCopilotProvider } from "@/features/ia/components/clinical-workflow/clinical-copilot-context";
import { ClinicFeaturesProvider } from "@/features/plugins/components/plugins/clinic-features-provider";
import { VoiceInputProvider } from "@/features/voice";

import {
  emptyClinicFeaturesContext,
  getCachedClinicFeatures,
} from "@/lib/server/cached-clinic-queries";
import { isRouteAllowedByPlugins } from "@/plugins/resolve";

function isNextNavigationError(err: unknown): boolean {
  if (typeof err !== "object" || err === null || !("digest" in err)) return false;
  const digest = String((err as { digest: string }).digest);
  return digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND");
}

function DashboardShellFallback({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 drflow-mesh p-6 text-center">
      <h1 className="text-lg font-semibold text-slate-900">No pudimos cargar el panel</h1>
      <p className="max-w-md text-sm text-slate-600">{message}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/dashboard"
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          Reintentar
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Ir al login
        </Link>
      </div>
    </div>
  );
}

async function DashboardDataShellInner({ children }: { children: React.ReactNode }) {
  const shell = await getDashboardShell();
  const { profile, clinics, clinicId, clinic, role, isSuperadmin } = shell;

  if (!profile) redirect("/login");
  if (clinics.length === 0 && !isSuperadmin) redirect("/onboarding");

  const path = (await headers()).get("x-drflow-path") ?? "";

  let clinicFeatures = emptyClinicFeaturesContext();
  if (clinicId) {
    try {
      clinicFeatures = await getCachedClinicFeatures(clinicId);
    } catch (err) {
      console.error("[dashboard-shell] getCachedClinicFeatures failed:", err);
    }
  }

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
      <PerformanceMonitor />
      <LazyDashboardInteractionHosts />
      <UpdateBanner />
      {showTrialBanner && clinic?.trial_ends_at && (
        <TrialBanner trialEndsAt={clinic.trial_ends_at} daysRemaining={daysLeft} />
      )}
      <DashboardSidebarProvider>
        <ClinicFeaturesProvider plugins={clinicFeatures.plugins} flags={clinicFeatures.flags}>
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
                      <LazyDashboardCopilotHosts />
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

/** Async dashboard shell — must not throw (layout-level); redirects only. */
export async function DashboardDataShell({ children }: { children: React.ReactNode }) {
  try {
    return await DashboardDataShellInner({ children });
  } catch (err) {
    if (isNextNavigationError(err)) throw err;
    console.error("[dashboard-shell] render failed:", err);
    return (
      <DashboardShellFallback message="Hubo un error al cargar tu sesión o el consultorio. Probá de nuevo." />
    );
  }
}

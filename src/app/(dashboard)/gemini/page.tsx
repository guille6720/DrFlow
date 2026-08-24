import { redirect } from "next/navigation";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { Header } from "@/core/components/layout/header";
import { FEATURES } from "@/core/entitlements/features";
import { requireAddonFeatureOrRedirect } from "@/core/entitlements/guard.server";
import { hasPermission } from "@/core/permissions/roles";

import { GeminiUsageHint } from "@/features/ia/components/clinical-workflow/gemini-usage-hint";
import { GeminiWorkspaceClient } from "@/features/ia/components/clinical-workflow/gemini-workspace-client";

export default async function GeminiPage() {
  await requireAddonFeatureOrRedirect(FEATURES.AI);
  const { profile, clinics, clinicId, role, isSuperadmin } = await getDashboardPageContext();

  if (!clinicId) {
    redirect("/login");
  }

  if (!hasPermission(role, "viewClinicalRecords", isSuperadmin)) {
    redirect("/dashboard");
  }

  return (
    <>
      <Header
        title="Gemini"
        subtitle="Asistente clínico dentro de DrFlow"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />
      <div className="p-3 sm:p-4">
        <p className="mb-4 text-sm text-slate-700">
          Asistente clínico para estadísticas del consultorio. El matching de candidatos a protocolos
          de investigación solo aparece si el flag está habilitado tras revisión legal/privacidad.
        </p>
        <GeminiUsageHint />
        <GeminiWorkspaceClient />
      </div>
    </>
  );
}

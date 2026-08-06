import { redirect } from "next/navigation";
import { Suspense } from "react";

import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/core/auth/session.server";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { ConfiguracionNavigator } from "@/features/configuracion";
import {
  renderConfiguracionSectionContent,
  type SettingsPanelData,
} from "@/features/configuracion/components/configuracion/configuracion-section-content";
import {
  resolveConfiguracionGroup,
  resolveConfiguracionSection,
} from "@/features/configuracion/components/configuracion/configuracion-sections";
import { DeleteAccountPanel } from "@/features/configuracion/components/configuracion/delete-account-panel";

import { getClinicFeatureFlagSettings } from "@/lib/actions/clinic-feature-flags";
import { getClinicJobsList } from "@/lib/actions/clinic-jobs";
import { getClinicPluginSettings } from "@/lib/actions/clinic-plugins";
import { getClinicObservabilityDashboard } from "@/lib/actions/observability";
import { loadTeamPermissionsPanelData } from "@/lib/actions/team-permissions";
import { getClinicSharedAiConnectionPublic } from "@/lib/ai/clinic-shared-ai.server";
import { getCachedActiveBookingSlug, getCachedClinicProfessionalsSettings } from "@/lib/server/cached-clinic-queries";
import { enrichTeamMembers } from "@/lib/utils/team-member-display";

interface PageProps {
  searchParams: Promise<{ seccion?: string; grupo?: string }>;
}

export default async function ConfiguracionPage({ searchParams }: PageProps) {
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { clinic, role, isSuperadmin } = await getActiveClinic();
  const { seccion, grupo } = await searchParams;

  if (seccion === "catalogo") {
    redirect("/ingreso-profesionales");
  }

  const activeSection = resolveConfiguracionSection(seccion);
  const activeGroup = resolveConfiguracionGroup(grupo);

  if (!hasPermission(role, "manageSettings", isSuperadmin)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  const [professionals, members, invitations, bookingSlug, patientCount, teamAccessBase, sharedAi] =
    clinicId
    ? await Promise.all([
        getCachedClinicProfessionalsSettings(clinicId),
        supabase
          .from("clinic_members")
          .select("id, role, is_active, profiles(full_name, email)")
          .eq("clinic_id", clinicId),
        supabase
          .from("clinic_invitations")
          .select("id, email, full_name, role, status, created_at, initial_password")
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false }),
        getCachedActiveBookingSlug(clinicId),
        supabase
          .from("patients")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .eq("is_active", true),
        loadTeamPermissionsPanelData(clinicId),
        getClinicSharedAiConnectionPublic(),
      ])
    : [[], { data: [] }, { data: [] }, null, { count: 0 }, { members: [], permissionOverrides: {} }, null];

  const settingsProps: SettingsPanelData = {
    clinic,
    professionals: professionals as never[],
    members: enrichTeamMembers(members.data ?? [], invitations.data ?? []) as never[],
    invitations: (invitations.data ?? []) as never[],
    bookingSlug,
    teamAccess: clinicId
      ? {
          ...teamAccessBase,
          hasSharedCredentials: Boolean(sharedAi),
        }
      : undefined,
  };

  const [pluginSettingsResult, flagSettingsResult, jobsResult, observabilityResult] =
    await Promise.all([
      getClinicPluginSettings(),
      getClinicFeatureFlagSettings(),
      getClinicJobsList(),
      getClinicObservabilityDashboard(),
    ]);

  const sectionContent = activeSection
    ? renderConfiguracionSectionContent(activeSection, settingsProps, {
        patientCount: patientCount.count ?? 0,
        practiceProfile: clinic?.practice_profile ?? null,
        defaultInsurance: clinic?.default_insurance_provider ?? null,
        acceptedCoverages: clinic?.accepted_coverages ?? null,
        pluginSettings: pluginSettingsResult.data ?? [],
        flagSettings: flagSettingsResult.data ?? [],
        jobSettings: jobsResult.data ?? [],
        observability: observabilityResult.data,
      })
    : undefined;

  const activeMembers = (members.data ?? []).filter(
    (m: { is_active?: boolean }) => m.is_active !== false
  );
  const isSoleClinicMember = Boolean(clinicId) && activeMembers.length === 1;

  return (
    <>
      <Header
        title="Configuración"
        subtitle={
          activeSection
            ? "Ajustá esta opción y volvé al grupo cuando termines"
            : activeGroup
              ? "Elegí qué querés configurar en este grupo"
              : "Elegí un área de configuración"
        }
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
        isSuperadmin={isSuperadmin}
      />

      <div className="p-4 sm:p-6">
        <Suspense fallback={<div className="text-sm text-slate-500">Cargando…</div>}>
          <ConfiguracionNavigator
            activeGroup={activeGroup}
            activeSection={activeSection}
            sectionContent={sectionContent}
            deleteAccount={
              !activeSection && !activeGroup ? (
                <DeleteAccountPanel
                  userEmail={profile?.email}
                  isSoleClinicMember={isSoleClinicMember}
                />
              ) : undefined
            }
          />
        </Suspense>
      </div>
    </>
  );
}

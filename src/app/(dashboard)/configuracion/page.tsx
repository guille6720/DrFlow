import { Suspense } from "react";
import { Header } from "@/components/layout/header";
import { SettingsPanel, ConfiguracionNavigator } from "@/features/configuracion";
import { DemoDataPanel } from "@/components/configuracion/demo-data-panel";
import { PamiSetupPanel } from "@/components/configuracion/pami-setup-panel";
import { CoveragesPanel } from "@/components/configuracion/coverages-panel";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions/roles";
import { AppearanceStylePanel } from "@/components/configuracion/appearance-style-panel";
import { ComplianceLegalPanel } from "@/components/configuracion/compliance-legal-panel";
import { ClinicPluginsPanel } from "@/components/configuracion/clinic-plugins-panel";
import { ClinicFeatureFlagsPanel } from "@/components/configuracion/clinic-feature-flags-panel";
import { ClinicJobsPanel } from "@/components/configuracion/clinic-jobs-panel";
import { ClinicObservabilityPanel } from "@/components/configuracion/clinic-observability-panel";
import { getClinicPluginSettings } from "@/lib/actions/clinic-plugins";
import { getClinicFeatureFlagSettings } from "@/lib/actions/clinic-feature-flags";
import { getClinicJobsList } from "@/lib/actions/clinic-jobs";
import { getClinicObservabilityDashboard } from "@/lib/actions/observability";
import { DeleteAccountPanel } from "@/components/configuracion/delete-account-panel";
import {
  resolveConfiguracionGroup,
  resolveConfiguracionSection,
  type ConfiguracionSectionId,
} from "@/components/configuracion/configuracion-sections";
import type { Clinic } from "@/types/database";

interface PageProps {
  searchParams: Promise<{ seccion?: string; grupo?: string }>;
}

interface SettingsPanelData {
  clinic: Clinic | null;
  professionals: never[];
  members: never[];
  invitations: never[];
  bookingSlug: string | null;
}

function renderSectionContent(
  sectionId: ConfiguracionSectionId,
  settingsProps: SettingsPanelData,
  extras: {
    patientCount: number;
    practiceProfile: string | null;
    defaultInsurance: string | null;
    acceptedCoverages: string[] | null;
    pluginSettings: Array<{
      id: import("@/plugins/registry").PluginId;
      label: string;
      description: string;
      tier: string;
      enabled: boolean;
    }>;
    flagSettings: Array<{
      id: import("@/lib/features/flags/registry").FeatureFlagId;
      label: string;
      description: string;
      category: string;
      enabled: boolean;
      requiresPlugin?: string;
    }>;
    jobSettings: Array<{
      id: string;
      jobType: string;
      jobLabel: string;
      status: import("@/lib/jobs/registry").ClinicJobStatus;
      statusLabel: string;
      errorMessage: string | null;
      createdAt: string;
      completedAt: string | null;
    }>;
    observability?: {
      snapshot: import("@/lib/server/load-observability").ObservabilitySnapshot;
      health: import("@/lib/observability/health").HealthStatus;
    };
  }
) {
  switch (sectionId) {
    case "legal":
      return <ComplianceLegalPanel />;
    case "apariencia":
      return <AppearanceStylePanel />;
    case "coberturas":
      return (
        <CoveragesPanel
          acceptedCoverages={extras.acceptedCoverages}
          defaultInsurance={extras.defaultInsurance}
        />
      );
    case "pami":
      return (
        <PamiSetupPanel
          practiceProfile={extras.practiceProfile}
          defaultInsurance={extras.defaultInsurance}
        />
      );
    case "plugins":
      return <ClinicPluginsPanel plugins={extras.pluginSettings} />;
    case "flags":
      return <ClinicFeatureFlagsPanel flags={extras.flagSettings} />;
    case "jobs":
      return <ClinicJobsPanel jobs={extras.jobSettings} />;
    case "observabilidad":
      return extras.observability ? (
        <ClinicObservabilityPanel
          snapshot={extras.observability.snapshot}
          health={extras.observability.health}
        />
      ) : null;
    case "demo":
      return <DemoDataPanel patientCount={extras.patientCount} />;
    case "clinica":
      return <SettingsPanel section="clinica" {...settingsProps} />;
    case "equipo":
      return <SettingsPanel section="equipo" {...settingsProps} />;
    case "agenda":
      return <SettingsPanel section="agenda" {...settingsProps} />;
    case "apps":
      return <SettingsPanel section="apps" {...settingsProps} />;
    default:
      return null;
  }
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

  const [professionals, members, invitations, booking, patientCount] = clinicId
    ? await Promise.all([
        supabase
          .from("professionals")
          .select("id, display_name, license_number, profiles(full_name), specialties(name)")
          .eq("clinic_id", clinicId),
        supabase
          .from("clinic_members")
          .select("id, role, is_active, profiles(full_name, email)")
          .eq("clinic_id", clinicId),
        supabase
          .from("clinic_invitations")
          .select("id, email, full_name, role, status, created_at")
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false }),
        supabase
          .from("public_booking_links")
          .select("slug")
          .eq("clinic_id", clinicId)
          .eq("is_active", true)
          .maybeSingle(),
        supabase
          .from("patients")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .eq("is_active", true),
      ])
    : [
        { data: [] },
        { data: [] },
        { data: [] },
        { data: null },
        { count: 0 },
      ];

  const settingsProps: SettingsPanelData = {
    clinic,
    professionals: (professionals.data ?? []) as never[],
    members: (members.data ?? []) as never[],
    invitations: (invitations.data ?? []) as never[],
    bookingSlug: booking.data?.slug ?? null,
  };

  const pluginSettingsResult = await getClinicPluginSettings();
  const pluginSettings = pluginSettingsResult.data ?? [];
  const flagSettingsResult = await getClinicFeatureFlagSettings();
  const flagSettings = flagSettingsResult.data ?? [];
  const jobsResult = await getClinicJobsList();
  const jobSettings = jobsResult.data ?? [];
  const observabilityResult = await getClinicObservabilityDashboard();
  const observability = observabilityResult.data;

  const sectionContent = activeSection
    ? renderSectionContent(activeSection, settingsProps, {
        patientCount: patientCount.count ?? 0,
        practiceProfile: clinic?.practice_profile ?? null,
        defaultInsurance: clinic?.default_insurance_provider ?? null,
        acceptedCoverages: clinic?.accepted_coverages ?? null,
        pluginSettings,
        flagSettings,
        jobSettings,
        observability,
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

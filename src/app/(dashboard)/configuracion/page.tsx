import { Suspense } from "react";
import { Header } from "@/components/layout/header";
import { ConfiguracionNavigator } from "@/features/configuracion";
import { DeleteAccountPanel } from "@/components/configuracion/delete-account-panel";
import {
  renderConfiguracionSectionContent,
  type SettingsPanelData,
} from "@/components/configuracion/configuracion-section-content";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions/roles";
import { getClinicPluginSettings } from "@/lib/actions/clinic-plugins";
import { getClinicFeatureFlagSettings } from "@/lib/actions/clinic-feature-flags";
import { getClinicJobsList } from "@/lib/actions/clinic-jobs";
import { getClinicObservabilityDashboard } from "@/lib/actions/observability";
import {
  resolveConfiguracionGroup,
  resolveConfiguracionSection,
} from "@/components/configuracion/configuracion-sections";

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
    : [{ data: [] }, { data: [] }, { data: [] }, { data: null }, { count: 0 }];

  const settingsProps: SettingsPanelData = {
    clinic,
    professionals: (professionals.data ?? []) as never[],
    members: (members.data ?? []) as never[],
    invitations: (invitations.data ?? []) as never[],
    bookingSlug: booking.data?.slug ?? null,
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

import { Suspense } from "react";
import { Header } from "@/components/layout/header";
import { SettingsPanel } from "@/components/configuracion/settings-panel";
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
import {
  ConfiguracionNavigator,
  ConfiguracionSection,
} from "@/components/configuracion/configuracion-navigator";
import { resolveConfiguracionGroup, resolveConfiguracionSection } from "@/components/configuracion/configuracion-sections";

interface PageProps {
  searchParams: Promise<{ seccion?: string; grupo?: string }>;
}

export default async function ConfiguracionPage({ searchParams }: PageProps) {
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { clinic, role, isSuperadmin } = await getActiveClinic();
  const { seccion, grupo } = await searchParams;
  const activeSection = resolveConfiguracionSection(seccion);
  const activeGroup = resolveConfiguracionGroup(grupo);

  if (!hasPermission(role, "manageSettings", isSuperadmin)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  const [specialties, locations, professionals, members, invitations, reasons, booking, patientCount] = clinicId
    ? await Promise.all([
        supabase.from("specialties").select("id, name").eq("clinic_id", clinicId),
        supabase.from("locations").select("id, name, address").eq("clinic_id", clinicId),
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
        supabase.from("consultation_reasons").select("id, name").eq("clinic_id", clinicId),
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
        { data: [] },
        { data: [] },
        { data: [] },
        { data: null },
        { count: 0 },
      ];

  const settingsProps = {
    clinic,
    specialties: specialties.data ?? [],
    locations: locations.data ?? [],
    professionals: (professionals.data ?? []) as never[],
    members: (members.data ?? []) as never[],
    invitations: (invitations.data ?? []) as never[],
    reasons: reasons.data ?? [],
    bookingSlug: booking.data?.slug ?? null,
  };

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
          <ConfiguracionNavigator activeGroup={activeGroup} activeSection={activeSection}>
            <ConfiguracionSection id="legal">
              <ComplianceLegalPanel />
            </ConfiguracionSection>

            <ConfiguracionSection id="apariencia">
              <AppearanceStylePanel />
            </ConfiguracionSection>

            <ConfiguracionSection id="coberturas">
              <CoveragesPanel
                acceptedCoverages={clinic?.accepted_coverages ?? null}
                defaultInsurance={clinic?.default_insurance_provider ?? null}
              />
            </ConfiguracionSection>

            <ConfiguracionSection id="pami">
              <PamiSetupPanel
                practiceProfile={clinic?.practice_profile ?? null}
                defaultInsurance={clinic?.default_insurance_provider ?? null}
              />
            </ConfiguracionSection>

            <ConfiguracionSection id="demo">
              <DemoDataPanel patientCount={patientCount.count ?? 0} />
            </ConfiguracionSection>

            <ConfiguracionSection id="clinica">
              <SettingsPanel section="clinica" {...settingsProps} />
            </ConfiguracionSection>

            <ConfiguracionSection id="equipo">
              <SettingsPanel section="equipo" {...settingsProps} />
            </ConfiguracionSection>

            <ConfiguracionSection id="catalogo">
              <SettingsPanel section="catalogo" {...settingsProps} />
            </ConfiguracionSection>

            <ConfiguracionSection id="agenda">
              <SettingsPanel section="agenda" {...settingsProps} />
            </ConfiguracionSection>

            <ConfiguracionSection id="apps">
              <SettingsPanel section="apps" {...settingsProps} />
            </ConfiguracionSection>
          </ConfiguracionNavigator>
        </Suspense>
      </div>
    </>
  );
}

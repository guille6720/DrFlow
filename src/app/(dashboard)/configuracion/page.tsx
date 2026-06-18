import { Header } from "@/components/layout/header";
import { SettingsPanel } from "@/components/configuracion/settings-panel";
import { DemoDataPanel } from "@/components/configuracion/demo-data-panel";
import { PamiSetupPanel } from "@/components/configuracion/pami-setup-panel";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions/roles";

export default async function ConfiguracionPage() {
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { clinic, role, isSuperadmin } = await getActiveClinic();

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

  return (
    <>
      <Header
        title="Configuración"
        subtitle="Profesionales, sedes, horarios y reserva online"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />

      <div className="p-4 sm:p-6">
        <PamiSetupPanel
          practiceProfile={clinic?.practice_profile ?? null}
          defaultInsurance={clinic?.default_insurance_provider ?? null}
        />
        <div className="mt-6">
          <DemoDataPanel patientCount={patientCount.count ?? 0} />
        </div>
        <div className="mt-6">
          <SettingsPanel
            clinic={clinic}
            specialties={specialties.data ?? []}
            locations={locations.data ?? []}
            professionals={(professionals.data ?? []) as never[]}
            members={(members.data ?? []) as never[]}
            invitations={(invitations.data ?? []) as never[]}
            reasons={reasons.data ?? []}
            bookingSlug={booking.data?.slug ?? null}
          />
        </div>
      </div>
    </>
  );
}

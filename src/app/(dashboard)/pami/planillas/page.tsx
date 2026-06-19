import { Header } from "@/components/layout/header";
import { PamiPlanillasView } from "@/components/pami/pami-planillas-view";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/roles";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PamiPlanillasPage() {
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();
  const supabase = await createClient();

  if (!hasPermission(role, "issuePrescriptions", isSuperadmin)) {
    redirect("/dashboard");
  }

  let patients: Array<{
    id: string;
    first_name: string;
    last_name: string;
    document_number: string;
    insurance_number: string | null;
    phone: string | null;
    address: string | null;
  }> = [];
  let professionals: Array<{
    id: string;
    display_name?: string | null;
    license_number?: string | null;
    profiles?: { full_name: string } | null;
  }> = [];
  let defaultProfessionalId: string | undefined;

  if (clinicId) {
    const [{ data: pats }, { data: profs }, { data: membership }] = await Promise.all([
      supabase
        .from("patients")
        .select("id, first_name, last_name, document_number, insurance_number, phone, address")
        .eq("clinic_id", clinicId)
        .order("last_name"),
      supabase
        .from("professionals")
        .select("id, display_name, license_number, profiles(full_name)")
        .eq("clinic_id", clinicId)
        .eq("is_active", true),
      supabase
        .from("clinic_members")
        .select("professional_id")
        .eq("clinic_id", clinicId)
        .eq("user_id", profile?.id ?? "")
        .maybeSingle(),
    ]);
    patients = pats ?? [];
    professionals = (profs ?? []) as unknown as typeof professionals;
    defaultProfessionalId = membership?.professional_id ?? professionals[0]?.id;
  }

  return (
    <>
      <Header
        title="Planillas PAMI"
        subtitle="Internación domiciliaria, geriátrico, insumos y solicitudes de cabecera"
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />

      <div className="p-4 sm:p-6">
        <PamiPlanillasView
          patients={patients}
          professionals={professionals}
          defaultProfessionalId={defaultProfessionalId}
        />
      </div>
    </>
  );
}

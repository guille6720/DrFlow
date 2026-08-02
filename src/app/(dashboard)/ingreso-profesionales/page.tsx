import { redirect } from "next/navigation";
import { ProfessionalIntakeView } from "@/components/profesionales/professional-intake-view";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions/roles";
import type { Professional } from "@/types/database";

export default async function IngresoProfesionalesPage() {
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!hasPermission(role, "manageStaff", isSuperadmin)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  const [{ data: locations }, { data: professionals }] = clinicId
    ? await Promise.all([
        supabase
          .from("locations")
          .select("id, name, address")
          .eq("clinic_id", clinicId)
          .order("name"),
        supabase
          .from("professionals")
          .select(
            "id, display_name, license_national, license_provincial, intake_completed_at, specialties(name)"
          )
          .eq("clinic_id", clinicId)
          .eq("is_active", true)
          .order("display_name"),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <ProfessionalIntakeView
      clinics={clinics}
      clinicId={clinicId}
      role={role}
      userName={profile?.full_name}
      locations={locations ?? []}
      professionals={(professionals ?? []) as Professional[]}
    />
  );
}

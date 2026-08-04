import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions/roles";
import { buildPatientWorkspaceUrl } from "@/lib/utils/patient-workspace-actions";
import NuevaConsultaForm from "./consulta-form";

export default async function NuevaConsultaPage({
  searchParams,
}: {
  searchParams: Promise<{
    patient?: string;
    appointment?: string;
    professional?: string;
  }>;
}) {
  const { patient, appointment, professional } = await searchParams;

  if (patient) {
    redirect(
      buildPatientWorkspaceUrl(patient, {
        tab: "soap",
        action: "nueva",
        appointment,
        professional,
      })
    );
  }

  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!hasPermission(role, "editClinicalRecords", isSuperadmin)) {
    redirect("/historias");
  }

  const supabase = await createClient();
  const [patients, professionals, templates] = clinicId
    ? await Promise.all([
        supabase.from("patients").select("*").eq("clinic_id", clinicId).eq("is_active", true),
        supabase
          .from("professionals")
          .select("*, profiles(full_name)")
          .eq("clinic_id", clinicId)
          .eq("is_active", true),
        supabase
          .from("clinical_templates")
          .select("*")
          .eq("clinic_id", clinicId)
          .eq("is_active", true),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  return (
    <NuevaConsultaForm
      clinics={clinics}
      clinicId={clinicId}
      role={role}
      userName={profile?.full_name}
      patients={patients.data ?? []}
      professionals={professionals.data ?? []}
      templates={templates.data ?? []}
      canIssuePrescriptions={hasPermission(role, "issuePrescriptions", isSuperadmin)}
    />
  );
}

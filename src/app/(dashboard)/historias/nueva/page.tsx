import {
  getDashboardPageContext,
} from "@/core/auth/dashboard-page";
import { createClient } from "@/core/supabase/server";
import {
  CLINICAL_TEMPLATE_COLUMNS,
  PATIENT_LIST_COLUMNS,
} from "@/core/supabase/select-columns";
import { redirect } from "next/navigation";
import { hasPermission } from "@/core/permissions/roles";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";
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

  const { profile, clinics, clinicId, role, isSuperadmin } = await getDashboardPageContext();

  if (!hasPermission(role, "editClinicalRecords", isSuperadmin)) {
    redirect("/historias");
  }

  const supabase = await createClient();
  const [patients, professionals, templates] = clinicId
    ? await Promise.all([
        supabase
          .from("patients")
          .select(PATIENT_LIST_COLUMNS)
          .eq("clinic_id", clinicId)
          .eq("is_active", true)
          .order("last_name")
          .limit(500),
        supabase
          .from("professionals")
          .select("id, display_name, license_number, profiles(full_name)")
          .eq("clinic_id", clinicId)
          .eq("is_active", true),
        supabase
          .from("clinical_templates")
          .select(CLINICAL_TEMPLATE_COLUMNS)
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
      professionals={(professionals.data ?? []) as never}
      templates={templates.data ?? []}
      canIssuePrescriptions={hasPermission(role, "issuePrescriptions", isSuperadmin)}
    />
  );
}

import { redirect } from "next/navigation";

import {
  getDashboardPageContext,
} from "@/core/auth/dashboard-page";
import { hasPermission } from "@/core/permissions/roles";
import { PATIENT_LIST_COLUMNS } from "@/core/supabase/select-columns";
import { createClient } from "@/core/supabase/server";

import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

import {
  getCachedClinicalTemplates,
  getCachedClinicProfessionalsList,
} from "@/lib/server/cached-clinic-queries";

import NuevaConsultaForm from "./nueva-consulta-form";

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
        getCachedClinicProfessionalsList(clinicId),
        getCachedClinicalTemplates(clinicId),
      ])
    : [{ data: [] }, [], []];

  return (
    <NuevaConsultaForm
      clinics={clinics}
      clinicId={clinicId}
      role={role}
      userName={profile?.full_name}
      patients={patients.data ?? []}
      professionals={professionals as never}
      templates={templates}
      canIssuePrescriptions={hasPermission(role, "issuePrescriptions", isSuperadmin)}
    />
  );
}

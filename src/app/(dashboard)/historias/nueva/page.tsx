import { redirect } from "next/navigation";

import {
  getDashboardPageContext,
} from "@/core/auth/dashboard-page";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

import {
  getCachedClinicalTemplates,
  getCachedClinicProfessionalsList,
} from "@/lib/server/cached-clinic-queries";
import { loadPatientPickerList } from "@/lib/server/load-patient-picker-list";

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
  const [patientPicker, professionals, templates] = clinicId
    ? await Promise.all([
        loadPatientPickerList(supabase, clinicId, { pageSize: 500 }),
        getCachedClinicProfessionalsList(clinicId),
        getCachedClinicalTemplates(clinicId),
      ])
    : [{ patients: [] }, [], []];

  return (
    <NuevaConsultaForm
      clinics={clinics}
      clinicId={clinicId}
      role={role}
      userName={profile?.full_name}
      patients={patientPicker.patients as never}
      professionals={professionals as never}
      templates={templates}
      canIssuePrescriptions={hasPermission(role, "issuePrescriptions", isSuperadmin)}
    />
  );
}

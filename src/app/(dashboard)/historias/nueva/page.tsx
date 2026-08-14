import { redirect } from "next/navigation";

import {
  getDashboardPageContext,
} from "@/core/auth/dashboard-page";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { buildConsultaSessionUrl } from "@/features/pacientes/utils/patient-workspace-actions";

import {
  getCachedClinicalTemplates,
  getCachedClinicProfessionalsList,
} from "@/lib/server/cached-clinic-queries";
import { resolveDefaultProfessionalId } from "@/lib/server/resolve-default-professional";

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

  if (patient || appointment) {
    redirect(
      buildConsultaSessionUrl({
        patient,
        appointment,
        professional,
      })
    );
  }

  const { profile, clinics, clinicId, role, isSuperadmin } = await getDashboardPageContext();

  if (!hasPermission(role, "editClinicalRecords", isSuperadmin)) {
    redirect("/pacientes?seccion=historias");
  }

  const supabase = await createClient();
  const [professionals, templates] = clinicId
    ? await Promise.all([
        getCachedClinicProfessionalsList(clinicId),
        getCachedClinicalTemplates(clinicId),
      ])
    : [[], []];

  const defaultProfessionalId = clinicId
    ? await resolveDefaultProfessionalId(supabase, clinicId, professionals, professional)
    : undefined;

  return (
    <NuevaConsultaForm
      clinics={clinics}
      clinicId={clinicId}
      role={role}
      userName={profile?.full_name}
      patients={[]}
      professionals={professionals}
      templates={templates}
      defaultProfessionalId={defaultProfessionalId}
      canIssuePrescriptions={hasPermission(role, "issuePrescriptions", isSuperadmin)}
    />
  );
}

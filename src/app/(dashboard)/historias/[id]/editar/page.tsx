import { notFound, redirect } from "next/navigation";

import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/core/auth/session";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { backHrefFromClinicalSubpage } from "@/shared/utils/clinical-navigation";

import { EditConsultaForm } from "@/features/historias";

import { getCachedClinicalTemplates } from "@/lib/server/cached-clinic-queries";

export default async function EditarHistoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; patient?: string }>;
}) {
  const { id } = await params;
  const { from, patient: returnPatientId } = await searchParams;
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!hasPermission(role, "editClinicalRecords", isSuperadmin)) {
    redirect(`/historias/${id}`);
  }

  const supabase = await createClient();
  if (!clinicId) notFound();

  const { data: record } = await supabase
    .from("clinical_records")
    .select("*")
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .single();

  if (!record) notFound();

  const [patientRes, templates] = await Promise.all([
    supabase.from("patients").select("*").eq("id", record.patient_id).eq("clinic_id", clinicId).maybeSingle(),
    getCachedClinicalTemplates(clinicId),
  ]);

  const backHref = backHrefFromClinicalSubpage(
    from,
    returnPatientId ?? record.patient_id,
    `/historias/${id}`
  );

  return (
    <EditConsultaForm
      record={record}
      patient={patientRes.data}
      clinics={clinics}
      clinicId={clinicId}
      role={role}
      userName={profile?.full_name}
      backHref={backHref}
      templates={templates}
      canIssuePrescriptions={hasPermission(role, "issuePrescriptions", isSuperadmin)}
    />
  );
}

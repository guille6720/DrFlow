import { notFound, redirect } from "next/navigation";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { hasPermission } from "@/core/permissions/roles";
import {
  CLINICAL_RECORD_EDIT_COLUMNS,
  PATIENT_CLINICAL_CONTEXT_COLUMNS,
} from "@/core/supabase/select-columns";
import { createClient } from "@/core/supabase/server";

import { backHrefFromClinicalSubpage, patientClinicalHistoryPath } from "@/shared/utils/clinical-navigation";

import { EditConsultaForm } from "@/features/historias";

import { getCachedClinicalTemplates } from "@/lib/server/cached-clinic-queries";
import type { Patient } from "@/types/database";

export default async function EditarHistoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; patient?: string }>;
}) {
  const { id } = await params;
  const { from, patient: returnPatientId } = await searchParams;
  const { profile, clinics, clinicId, role, isSuperadmin } = await getDashboardPageContext();

  if (!hasPermission(role, "editClinicalRecords", isSuperadmin)) {
    redirect(`/historias/${id}`);
  }

  const supabase = await createClient();
  if (!clinicId) notFound();

  const { data: record } = await supabase
    .from("clinical_records")
    .select(CLINICAL_RECORD_EDIT_COLUMNS)
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .single();

  if (!record) notFound();

  const [patientRes, templates] = await Promise.all([
    supabase
      .from("patients")
      .select(PATIENT_CLINICAL_CONTEXT_COLUMNS)
      .eq("id", record.patient_id)
      .eq("clinic_id", clinicId)
      .maybeSingle(),
    getCachedClinicalTemplates(clinicId),
  ]);

  const backHref = backHrefFromClinicalSubpage(
    from,
    returnPatientId ?? record.patient_id,
    patientClinicalHistoryPath(record.patient_id)
  );

  return (
    <EditConsultaForm
      record={record}
      patient={(patientRes.data as Patient | null) ?? null}
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

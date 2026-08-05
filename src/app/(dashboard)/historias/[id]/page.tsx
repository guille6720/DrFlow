import { notFound, redirect } from "next/navigation";

import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/core/auth/session";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { HistoriaDetailContent } from "@/features/historias/components/historias/historia-detail-content";
import { loadHistoriaDetailPageData } from "@/features/historias/server/load-historia-detail-page";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

export default async function HistoriaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; patient?: string; embed?: string }>;
}) {
  const { id } = await params;
  const { from, patient: returnPatientId, embed } = await searchParams;
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin, clinic } = await getActiveClinic();
  const supabase = await createClient();

  if (!clinicId) notFound();

  if (embed !== "1") {
    const { data: recordRef } = await supabase
      .from("clinical_records")
      .select("patient_id")
      .eq("id", id)
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (!recordRef?.patient_id) notFound();

    redirect(
      buildPatientWorkspaceUrl(recordRef.patient_id, {
        tab: "soap",
        record: id,
        mode: "view",
      })
    );
  }

  const data = await loadHistoriaDetailPageData(supabase, id, clinicId);
  if (!data) notFound();

  const canIssue = hasPermission(role, "issuePrescriptions", isSuperadmin);
  const canEditClinical = hasPermission(role, "editClinicalRecords", isSuperadmin);
  const canViewClinical = hasPermission(role, "viewClinicalRecords", isSuperadmin);
  const canFinalize = hasPermission(role, "editClinicalRecords", isSuperadmin);

  return (
    <>
      <Header
        title="Detalle de consulta"
        subtitle={`${data.patient.last_name}, ${data.patient.first_name}`}
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />
      <HistoriaDetailContent
        id={id}
        from={from}
        returnPatientId={returnPatientId}
        profileName={profile?.full_name}
        canIssue={canIssue}
        canEditClinical={canEditClinical}
        canViewClinical={canViewClinical}
        canFinalize={canFinalize}
        clinic={clinic}
        {...data}
      />
    </>
  );
}

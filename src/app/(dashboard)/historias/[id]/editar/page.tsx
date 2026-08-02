import { notFound, redirect } from "next/navigation";
import { EditConsultaForm } from "@/components/historias/edit-consulta-form";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions/roles";
import { backHrefFromClinicalSubpage } from "@/lib/utils/clinical-navigation";

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

  const backHref = backHrefFromClinicalSubpage(
    from,
    returnPatientId ?? record.patient_id,
    `/historias/${id}`
  );

  return (
    <EditConsultaForm
      record={record}
      clinics={clinics}
      clinicId={clinicId}
      role={role}
      userName={profile?.full_name}
      backHref={backHref}
    />
  );
}

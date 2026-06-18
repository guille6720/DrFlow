import { notFound } from "next/navigation";
import { EditPatientForm } from "@/components/pacientes/edit-patient-form";
import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions/roles";
import { redirect } from "next/navigation";

export default async function EditarPacientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!hasPermission(role, "managePatients", isSuperadmin)) {
    redirect("/pacientes");
  }

  const supabase = await createClient();
  if (!clinicId) notFound();

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .single();

  if (!patient) notFound();

  return (
    <EditPatientForm
      patient={patient}
      clinics={clinics}
      clinicId={clinicId}
      role={role}
      userName={profile?.full_name}
    />
  );
}

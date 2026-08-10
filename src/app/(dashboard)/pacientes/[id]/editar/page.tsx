import { notFound } from "next/navigation";
import { redirect } from "next/navigation";

import {
  getActiveClinic,
  getActiveClinicId,
  getProfile,
  getUserClinics,
} from "@/core/auth/session";
import { hasPermission } from "@/core/permissions/roles";
import { PATIENT_DETAIL_COLUMNS } from "@/core/supabase/select-columns";
import { createClient } from "@/core/supabase/server";

import { EditPatientForm } from "@/features/pacientes/components/pacientes/edit-patient-form";

import type { Patient } from "@/types/database";

export default async function EditarPacientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin, clinic } = await getActiveClinic();

  if (!hasPermission(role, "managePatients", isSuperadmin)) {
    redirect("/pacientes");
  }

  const supabase = await createClient();
  if (!clinicId) notFound();

  const { data: patient } = await supabase
    .from("patients")
    .select(PATIENT_DETAIL_COLUMNS)
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .single();

  if (!patient) notFound();

  return (
    <EditPatientForm
      patient={patient as Patient}
      clinics={clinics}
      clinicId={clinicId}
      role={role}
      userName={profile?.full_name}
      defaultInsurance={clinic?.default_insurance_provider ?? null}
      acceptedCoverages={clinic?.accepted_coverages ?? null}
    />
  );
}

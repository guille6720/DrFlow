import { redirect } from "next/navigation";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { createClient } from "@/core/supabase/server";

import { patientWorkspacePath } from "@/features/pacientes/constants/patient-workspace-tabs";

/** Compat: la HC electrónica vive en el workspace del paciente (Fase 4). */
export default async function PatientClinicalHistoryRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: patientId } = await params;
  const { clinicId } = await getDashboardPageContext();
  const supabase = await createClient();

  if (clinicId) {
    const { data: patient } = await supabase
      .from("patients")
      .select("id")
      .eq("id", patientId)
      .eq("clinic_id", clinicId)
      .maybeSingle();
    if (!patient) redirect("/historias");
  }

  redirect(patientWorkspacePath(patientId, "soap"));
}

import { redirect } from "next/navigation";
import { getActiveClinicId } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { patientWorkspacePath } from "@/lib/constants/patient-workspace-tabs";

/** Compat: la HC electrónica vive en el workspace del paciente (Fase 4). */
export default async function PatientClinicalHistoryRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: patientId } = await params;
  const clinicId = await getActiveClinicId();
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

  redirect(patientWorkspacePath(patientId, "evoluciones"));
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/core/supabase/server";
import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { parseEntityId, firstZodIssue } from "@/core/validations/params";
import { clinicalIndicatorsSchema } from "@/core/validations/clinical-indicators";
import { saveClinicalIndicators } from "@/features/pacientes/services/patient-chart-indicators.service";

export type { ClinicalIndicatorsInput } from "@/features/pacientes/services/patient-chart-indicators.service";

export async function savePatientClinicalIndicators(
  patientId: string,
  input: unknown
): Promise<{ error?: string }> {
  const access = await requireClinicPermission("editClinicalRecords");
  if (!access.ok) return { error: access.error };

  const idParsed = parseEntityId(patientId, "Paciente");
  if (!idParsed.ok) return { error: idParsed.error };

  const parsed = clinicalIndicatorsSchema.safeParse(input);
  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const supabase = await createClient();
  const result = await saveClinicalIndicators(
    supabase,
    idParsed.data,
    access.clinicId,
    parsed.data
  );
  if (!result.ok) return { error: result.error };

  revalidatePath(`/pacientes/${idParsed.data}`);
  revalidatePath(`/pacientes/${idParsed.data}?tab=soap`);
  return {};
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClinicPermission } from "@/lib/actions/clinic-guard";
import {
  saveClinicalIndicators,
  type ClinicalIndicatorsInput,
} from "@/lib/services/patient-chart-indicators.service";

export type { ClinicalIndicatorsInput };

export async function savePatientClinicalIndicators(
  patientId: string,
  input: ClinicalIndicatorsInput
): Promise<{ error?: string }> {
  const access = await requireClinicPermission("editClinicalRecords");
  if (!access.ok) return { error: access.error };

  const supabase = await createClient();
  const result = await saveClinicalIndicators(supabase, patientId, access.clinicId, input);
  if (!result.ok) return { error: result.error };

  revalidatePath(`/pacientes/${patientId}`);
  revalidatePath(`/pacientes/${patientId}?tab=soap`);
  return {};
}

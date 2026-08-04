/**
 * Backward-compatible re-exports — loaders and legacy imports use this path.
 * Data access: repositories · Business logic: services.
 */
export type { PatientClinicalProfileFields } from "@/features/pacientes/repositories/patient-clinical-profile.repository";

export {
  findPatientClinicalProfile as loadPatientClinicalProfile,
  findPatientClinicalProfilesByIds as loadPatientClinicalProfilesByIds,
  mergePatientClinicalFields,
  extractClinicalProfileFields,
} from "@/features/pacientes/repositories/patient-clinical-profile.repository";

import type { DbClient } from "@/core/repositories/types";
import {
  upsertPatientClinicalProfileRow,
  type PatientClinicalProfileFields,
} from "@/features/pacientes/repositories/patient-clinical-profile.repository";

/** Preserves legacy `{ error: string | null }` contract for existing callers. */
export async function upsertPatientClinicalProfile(
  supabase: DbClient,
  patientId: string,
  clinicId: string,
  fields: Partial<PatientClinicalProfileFields>
): Promise<{ error: string | null }> {
  const result = await upsertPatientClinicalProfileRow(supabase, patientId, clinicId, fields);
  return { error: result.ok ? null : result.error };
}

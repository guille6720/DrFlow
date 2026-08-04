import type { ConsultationModality } from "@/lib/constants/consultation-modality";
import type { DbClient, RepoResult } from "@/core/repositories/types";
import { repoErr, repoOk } from "@/core/repositories/types";

export async function markAppointmentAttended(
  db: DbClient,
  appointmentId: string,
  clinicId: string,
  modality: ConsultationModality
): Promise<RepoResult<void>> {
  const { error } = await db
    .from("appointments")
    .update({
      status: "attended",
      consultation_modality: modality,
      updated_at: new Date().toISOString(),
    })
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId);

  if (error) return repoErr(error.message);
  return repoOk(undefined);
}

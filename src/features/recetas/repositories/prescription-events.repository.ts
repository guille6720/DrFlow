import type { DbClient, RepoResult } from "@/core/repositories/types";
import { mapPostgresError, repoErr, repoOk } from "@/core/repositories/types";

import type { PrescriptionEventType } from "@/features/recetas/engine/types";

export type PrescriptionEventInsertRow = {
  prescription_id: string;
  clinic_id: string;
  event_type: PrescriptionEventType;
  actor_id: string | null;
  payload?: Record<string, unknown>;
};

export async function insertPrescriptionEvent(
  db: DbClient,
  row: PrescriptionEventInsertRow
): Promise<RepoResult<{ id: string }>> {
  const { data, error } = await db
    .from("prescription_events")
    .insert({
      prescription_id: row.prescription_id,
      clinic_id: row.clinic_id,
      event_type: row.event_type,
      actor_id: row.actor_id,
      payload: row.payload ?? {},
    })
    .select("id")
    .single();

  if (error) return repoErr(mapPostgresError(error));
  return repoOk(data as { id: string });
}

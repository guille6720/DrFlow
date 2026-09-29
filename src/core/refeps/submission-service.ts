import "server-only";

import type { RefepsClinicSettings } from "@/core/refeps/types";
import type { DbClient } from "@/core/repositories/types";

/**
 * Clinic-level national prescription settings (legacy column names from migration 102).
 * Submission itself lives in `src/core/renapdis/national-prescription` (REFEPS validation →
 * ReNaPDiS repository). REFEPS is never used as a prescription repository.
 */
export type ClinicRefepsRow = {
  id: string;
  name: string;
  refeps_enabled: boolean;
  refeps_establishment_code: string | null;
  refeps_auto_submit: boolean;
};

export async function loadClinicRefepsRow(
  db: DbClient,
  clinicId: string
): Promise<ClinicRefepsRow | null> {
  const { data, error } = await db
    .from("clinics")
    .select("id, name, refeps_enabled, refeps_establishment_code, refeps_auto_submit")
    .eq("id", clinicId)
    .maybeSingle();

  if (error || !data) return null;
  return data as ClinicRefepsRow;
}

export function mapClinicRefepsSettings(row: ClinicRefepsRow): RefepsClinicSettings {
  return {
    enabled: row.refeps_enabled,
    establishmentCode: row.refeps_establishment_code,
    autoSubmit: row.refeps_auto_submit,
  };
}

import type { DbClient } from "@/core/repositories/types";

export type ClinicInsuranceDefaults = {
  default_insurance_provider: string | null;
  accepted_coverages: string[] | null;
};

export async function findClinicInsuranceDefaults(
  db: DbClient,
  clinicId: string
): Promise<ClinicInsuranceDefaults | null> {
  const { data } = await db
    .from("clinics")
    .select("default_insurance_provider, accepted_coverages")
    .eq("id", clinicId)
    .single();

  return data;
}

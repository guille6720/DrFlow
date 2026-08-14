import type { SupabaseClient } from "@supabase/supabase-js";

export type ClinicCie10Stat = {
  cie10_code: string;
  diagnosis_name: string;
  occurrence_count: number;
};

export type ClinicTreatmentStat = {
  product: string;
  active_ingredient: string | null;
  occurrence_count: number;
};

export async function loadClinicStructuredClinicalStats(
  supabase: SupabaseClient,
  clinicId: string,
  limit = 12
): Promise<{ cie10: ClinicCie10Stat[]; treatments: ClinicTreatmentStat[] }> {
  const [{ data: cie10 }, { data: treatments }] = await Promise.all([
    supabase.rpc("clinic_cie10_occurrence_stats", {
      p_clinic_id: clinicId,
      p_limit: limit,
    }),
    supabase.rpc("clinic_treatment_occurrence_stats", {
      p_clinic_id: clinicId,
      p_limit: limit,
    }),
  ]);

  return {
    cie10: ((cie10 ?? []) as ClinicCie10Stat[]).map((row) => ({
      cie10_code: row.cie10_code,
      diagnosis_name: row.diagnosis_name,
      occurrence_count: Number(row.occurrence_count) || 0,
    })),
    treatments: ((treatments ?? []) as ClinicTreatmentStat[]).map((row) => ({
      product: row.product,
      active_ingredient: row.active_ingredient,
      occurrence_count: Number(row.occurrence_count) || 0,
    })),
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";

import { PATIENT_SEARCH_API_LIMIT } from "@/core/supabase/pagination";

import { validatePatientSearchQuery } from "@/features/pacientes/utils/patient-search-query";

export type PatientSearchRow = {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
  birth_date?: string | null;
  insurance_provider?: string | null;
  insurance_number?: string | null;
  phone?: string | null;
  address?: string | null;
};

type SearchPatientsOptions = {
  clinicId: string;
  q: string;
  limit?: number;
  cobertura?: "pami";
};

/** Server-side patient search via `search_patients_for_clinic` RPC. */
export async function searchPatientsForClinic(
  supabase: SupabaseClient,
  options: SearchPatientsOptions
): Promise<{ patients: PatientSearchRow[]; error?: string }> {
  const parsed = validatePatientSearchQuery(options.q);
  if (!parsed.ok) {
    return { patients: [] };
  }

  const limit = Math.min(Math.max(options.limit ?? PATIENT_SEARCH_API_LIMIT, 1), 50);

  const { data, error } = await supabase.rpc("search_patients_for_clinic", {
    p_clinic_id: options.clinicId,
    p_query: parsed.q,
    p_limit: limit,
    p_pami_only: options.cobertura === "pami",
  });

  if (error) {
    return { patients: [], error: error.message };
  }

  return { patients: (data ?? []) as PatientSearchRow[] };
}

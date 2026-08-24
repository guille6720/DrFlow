import type { SupabaseClient } from "@supabase/supabase-js";

import { PATIENT_LIST_ID_IN_LIMIT, PATIENT_SEARCH_API_LIMIT } from "@/core/supabase/pagination";

import { validatePatientSearchQuery } from "@/features/pacientes/utils/patient-search-query";

export type PatientSearchRow = {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
  birth_date?: string | null;
  insurance_provider?: string | null;
  insurance_plan?: string | null;
  insurance_number?: string | null;
  phone?: string | null;
  address?: string | null;
  email?: string | null;
};

type SearchPatientsOptions = {
  clinicId: string;
  q: string;
  limit?: number;
  offset?: number;
  cobertura?: "pami";
};

const LIST_SEARCH_ID_LIMIT = PATIENT_LIST_ID_IN_LIMIT;

function pamiOnly(cobertura?: "pami"): boolean {
  return cobertura === "pami";
}

/** Server-side patient search via `search_patients_for_clinic` RPC. */
export async function searchPatientsForClinic(
  supabase: SupabaseClient,
  options: SearchPatientsOptions
): Promise<{ patients: PatientSearchRow[]; error?: string }> {
  const parsed = validatePatientSearchQuery(options.q);
  if (!parsed.ok) {
    return { patients: [] };
  }

  const requested = options.limit ?? PATIENT_SEARCH_API_LIMIT;
  const limit = Math.min(Math.max(requested, 1), requested > 50 ? 500 : 50);
  const offset = Math.max(options.offset ?? 0, 0);

  const { data, error } = await supabase.rpc("search_patients_for_clinic", {
    p_clinic_id: options.clinicId,
    p_query: parsed.q,
    p_limit: limit,
    p_pami_only: pamiOnly(options.cobertura),
    p_offset: offset,
  });

  if (error) {
    return { patients: [], error: error.message };
  }

  return { patients: (data ?? []) as PatientSearchRow[] };
}

/** Total matches for list pagination (RPC 091). Falls back to result length when RPC missing. */
export async function countPatientsForClinicSearch(
  supabase: SupabaseClient,
  clinicId: string,
  q: string,
  cobertura?: "pami"
): Promise<{ count: number; error?: string }> {
  const parsed = validatePatientSearchQuery(q);
  if (!parsed.ok) {
    return { count: 0 };
  }

  const { data, error } = await supabase.rpc("count_patients_for_clinic_search", {
    p_clinic_id: clinicId,
    p_query: parsed.q,
    p_pami_only: pamiOnly(cobertura),
  });

  if (error) {
    return { count: 0, error: error.message };
  }

  return { count: Number(data ?? 0) };
}

/** Paginated list search for server-rendered pages (uses RPC offset; max page size 500). */
export async function searchPatientsForClinicListPage(
  supabase: SupabaseClient,
  options: {
    clinicId: string;
    q: string;
    page: number;
    pageSize: number;
    cobertura?: "pami";
  }
): Promise<{ patients: PatientSearchRow[]; total: number; error?: string }> {
  const parsed = validatePatientSearchQuery(options.q);
  if (!parsed.ok) {
    return { patients: [], total: 0 };
  }

  const page = Math.max(1, options.page);
  const pageSize = Math.min(Math.max(options.pageSize, 1), 500);
  const offset = (page - 1) * pageSize;

  const [countResult, searchResult] = await Promise.all([
    countPatientsForClinicSearch(supabase, options.clinicId, parsed.q, options.cobertura),
    searchPatientsForClinic(supabase, {
      clinicId: options.clinicId,
      q: parsed.q,
      limit: pageSize,
      offset,
      cobertura: options.cobertura,
    }),
  ]);

  if (countResult.error && searchResult.error) {
    return { patients: [], total: 0, error: countResult.error ?? searchResult.error };
  }

  return {
    patients: searchResult.patients,
    total: countResult.count,
    error: countResult.error ?? searchResult.error,
  };
}

/** Patient IDs for filtering related tables (waiting list, pathology intersect). */
export async function findPatientIdsByTextSearch(
  supabase: SupabaseClient,
  clinicId: string,
  q: string,
  options?: { cobertura?: "pami"; limit?: number }
): Promise<{ patientIds: string[]; error?: string }> {
  const parsed = validatePatientSearchQuery(q);
  if (!parsed.ok) {
    return { patientIds: [] };
  }

  const limit = Math.min(Math.max(options?.limit ?? LIST_SEARCH_ID_LIMIT, 1), LIST_SEARCH_ID_LIMIT);
  const { patients, error } = await searchPatientsForClinic(supabase, {
    clinicId,
    q: parsed.q,
    limit,
    offset: 0,
    cobertura: options?.cobertura,
  });

  if (error) {
    return { patientIds: [], error };
  }

  return { patientIds: patients.map((p) => p.id) };
}

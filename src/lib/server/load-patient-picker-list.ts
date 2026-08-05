import type { SupabaseClient } from "@supabase/supabase-js";

import { PATIENT_PICKER_INITIAL_LIMIT } from "@/core/supabase/pagination";

import { applyPatientSearchFilter } from "@/features/pacientes/utils/patient-search";

/** Paginated patient list for form pickers (search + offset). */
export async function loadPatientPickerList(
  supabase: SupabaseClient,
  clinicId: string,
  options?: { q?: string; page?: number; pageSize?: number }
) {
  const pageSize = options?.pageSize ?? PATIENT_PICKER_INITIAL_LIMIT;
  const page = Math.max(1, options?.page ?? 1);
  const from = (page - 1) * pageSize;

  let query = supabase
    .from("patients")
    .select("id, first_name, last_name, document_number", { count: "exact" })
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .order("last_name");

  if (options?.q) {
    query = applyPatientSearchFilter(query, options.q);
  }

  const { data, count } = await query.range(from, from + pageSize - 1);
  return { patients: data ?? [], total: count ?? 0, page, pageSize };
}

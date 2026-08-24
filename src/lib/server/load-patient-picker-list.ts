import type { SupabaseClient } from "@supabase/supabase-js";

import { PATIENT_PICKER_INITIAL_LIMIT } from "@/core/supabase/pagination";
import type { ConsultPatientPickerRow, PatientPickerRow } from "@/core/supabase/query-types";

import {
  countPatientsForClinicSearch,
  searchPatientsForClinic,
} from "@/features/pacientes/server/search-patients";

type PickerListResult<T extends PatientPickerRow> = {
  patients: T[];
  total: number;
  page: number;
  pageSize: number;
};

function mapSearchRow(patient: {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
}): PatientPickerRow {
  return {
    id: patient.id,
    first_name: patient.first_name,
    last_name: patient.last_name,
    document_number: patient.document_number,
  };
}

/** Paginated patient list for form pickers (search + offset in PostgreSQL). */
export async function loadPatientPickerList(
  supabase: SupabaseClient,
  clinicId: string,
  options?: { q?: string; page?: number; pageSize?: number; includeClinicalFields?: true }
): Promise<PickerListResult<ConsultPatientPickerRow>>;
export async function loadPatientPickerList(
  supabase: SupabaseClient,
  clinicId: string,
  options?: { q?: string; page?: number; pageSize?: number; includeClinicalFields?: boolean }
): Promise<PickerListResult<PatientPickerRow>>;
export async function loadPatientPickerList(
  supabase: SupabaseClient,
  clinicId: string,
  options?: { q?: string; page?: number; pageSize?: number; includeClinicalFields?: boolean }
): Promise<PickerListResult<PatientPickerRow | ConsultPatientPickerRow>> {
  const pageSize = options?.pageSize ?? PATIENT_PICKER_INITIAL_LIMIT;
  const page = Math.max(1, options?.page ?? 1);
  const from = (page - 1) * pageSize;

  if (options?.q?.trim()) {
    const [searchResult, countResult] = await Promise.all([
      searchPatientsForClinic(supabase, {
        clinicId,
        q: options.q,
        limit: pageSize,
        offset: from,
      }),
      countPatientsForClinicSearch(supabase, clinicId, options.q),
    ]);

    if (searchResult.error) {
      return { patients: [], total: 0, page, pageSize };
    }

    const total = countResult.error ? searchResult.patients.length : countResult.count;

    if (options.includeClinicalFields) {
      return {
        patients: searchResult.patients as ConsultPatientPickerRow[],
        total,
        page,
        pageSize,
      };
    }

    return {
      patients: searchResult.patients.map(mapSearchRow),
      total,
      page,
      pageSize,
    };
  }

  if (options?.includeClinicalFields) {
    const { data, count } = await supabase
      .from("patients")
      .select(
        "id, first_name, last_name, document_number, allergies, regular_medication, medical_history",
        { count: "exact" }
      )
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("last_name")
      .range(from, from + pageSize - 1);

    return { patients: data ?? [], total: count ?? 0, page, pageSize };
  }

  const { data, count } = await supabase
    .from("patients")
    .select("id, first_name, last_name, document_number", { count: "exact" })
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .order("last_name")
    .range(from, from + pageSize - 1);

  return { patients: data ?? [], total: count ?? 0, page, pageSize };
}

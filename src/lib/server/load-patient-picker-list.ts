import type { SupabaseClient } from "@supabase/supabase-js";

import { PATIENT_PICKER_INITIAL_LIMIT, PATIENT_SEARCH_API_LIMIT } from "@/core/supabase/pagination";
import type { ConsultPatientPickerRow, PatientPickerRow } from "@/core/supabase/query-types";

import { searchPatientsForClinic } from "@/features/pacientes/server/search-patients";

type PickerListResult<T extends PatientPickerRow> = {
  patients: T[];
  total: number;
  page: number;
  pageSize: number;
};

/** Paginated patient list for form pickers (search + offset). */
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
    const { patients, error } = await searchPatientsForClinic(supabase, {
      clinicId,
      q: options.q,
      limit: Math.max(pageSize, PATIENT_SEARCH_API_LIMIT),
    });

    if (error) {
      return { patients: [], total: 0, page, pageSize };
    }

    const slice = patients.slice(from, from + pageSize);
    if (options.includeClinicalFields) {
      return {
        patients: slice as ConsultPatientPickerRow[],
        total: patients.length,
        page,
        pageSize,
      };
    }

    return {
      patients: slice.map((patient) => ({
        id: patient.id,
        first_name: patient.first_name,
        last_name: patient.last_name,
        document_number: patient.document_number,
      })),
      total: patients.length,
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

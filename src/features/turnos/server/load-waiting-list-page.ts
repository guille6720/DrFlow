import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildPageMeta,
  offsetRange,
  type PageMeta,
  parsePageParam,
  WAITING_LIST_PAGE_SIZE,
} from "@/core/supabase/pagination";

import { findPatientIdsByTextSearch } from "@/features/pacientes/server/search-patients";
import { sanitizePatientSearchTerm } from "@/features/pacientes/utils/patient-search";
import type { WaitingListRow } from "@/features/turnos/components/waiting-list-view";

export { parsePageParam as parseWaitingListPage, WAITING_LIST_PAGE_SIZE };

export function buildWaitingListUrl(page = 1, q = ""): string {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  const term = sanitizePatientSearchTerm(q);
  if (term) params.set("q", term);
  const qs = params.toString();
  return qs ? `/turnos/lista-espera?${qs}` : "/turnos/lista-espera";
}

function normalizeWaitingListRows(raw: unknown[]): WaitingListRow[] {
  return raw.map((row) => {
    const entry = row as Record<string, unknown>;
    const patients = entry.patients;
    const professionals = entry.professionals;
    const specialties = entry.specialties;

    return {
      ...(entry as Omit<WaitingListRow, "patients" | "professionals" | "specialties">),
      patients: Array.isArray(patients) ? patients[0] ?? null : (patients as WaitingListRow["patients"]),
      professionals: Array.isArray(professionals)
        ? professionals[0] ?? null
        : (professionals as WaitingListRow["professionals"]),
      specialties: Array.isArray(specialties)
        ? specialties[0] ?? null
        : (specialties as WaitingListRow["specialties"]),
    };
  });
}

export type WaitingListPageData = {
  entries: WaitingListRow[];
  pageMeta: PageMeta;
  searchQuery: string;
};

export async function loadWaitingListPageData(
  supabase: SupabaseClient,
  clinicId: string,
  q: string,
  page: number
): Promise<WaitingListPageData> {
  const searchQuery = sanitizePatientSearchTerm(q);
  let patientIds: string[] | null = null;

  if (searchQuery) {
    const { patientIds: matches, error: searchError } = await findPatientIdsByTextSearch(
      supabase,
      clinicId,
      searchQuery
    );
    if (searchError) {
      return {
        entries: [],
        pageMeta: buildPageMeta(0, page, WAITING_LIST_PAGE_SIZE),
        searchQuery,
      };
    }
    patientIds = matches;

    if (patientIds.length === 0) {
      return {
        entries: [],
        pageMeta: buildPageMeta(0, page, WAITING_LIST_PAGE_SIZE),
        searchQuery,
      };
    }
  }

  let query = supabase
    .from("waiting_list")
    .select(
      `id, status, notes, consultation_modality, preferred_date_from, preferred_date_to,
       preferred_time_from, preferred_time_to, created_at,
       patients(first_name, last_name, document_number, phone),
       professionals(display_name, profiles(full_name)),
       specialties(name)`,
      { count: "exact" }
    )
    .eq("clinic_id", clinicId)
    .in("status", ["active", "contacted"])
    .order("created_at", { ascending: true });

  if (patientIds) {
    query = query.in("patient_id", patientIds);
  }

  const { from, to } = offsetRange(page, WAITING_LIST_PAGE_SIZE);
  const { data, count } = await query.range(from, to);

  return {
    entries: normalizeWaitingListRows(data ?? []),
    pageMeta: buildPageMeta(count ?? 0, page, WAITING_LIST_PAGE_SIZE),
    searchQuery,
  };
}

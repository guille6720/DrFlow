import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildPageMeta,
  offsetRange,
  PAMI_PATIENTS_PAGE_SIZE,
} from "@/core/supabase/pagination";

import { applyPatientSearchFilter } from "@/features/pacientes/utils/patient-search";

import { getCachedClinicProfessionalsList } from "@/lib/server/cached-clinic-queries";

export type PamiPlanillaPatient = {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
  insurance_number: string | null;
  phone: string | null;
  address: string | null;
};

export type PamiPlanillasPageData = {
  patients: PamiPlanillaPatient[];
  professionals: Awaited<ReturnType<typeof getCachedClinicProfessionalsList>>;
  defaultProfessionalId: string | undefined;
  pageMeta: ReturnType<typeof buildPageMeta>;
  searchQuery: string;
};

export function buildPamiPlanillasUrl(q: string, page: number): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const s = params.toString();
  return s ? `/pami/planillas?${s}` : "/pami/planillas";
}

export async function loadPamiPlanillasPageData(
  supabase: SupabaseClient,
  clinicId: string,
  userId: string | undefined,
  q: string,
  page: number
): Promise<PamiPlanillasPageData> {
  let patientQuery = supabase
    .from("patients")
    .select(
      "id, first_name, last_name, document_number, insurance_number, phone, address",
      { count: "exact" }
    )
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .ilike("insurance_provider", "%PAMI%")
    .order("last_name");

  if (q) {
    patientQuery = applyPatientSearchFilter(patientQuery, q);
  }

  const { from, to } = offsetRange(page, PAMI_PATIENTS_PAGE_SIZE);

  const [{ data: patients, count }, professionals, { data: membership }] = await Promise.all([
    patientQuery.range(from, to),
    getCachedClinicProfessionalsList(clinicId),
    supabase
      .from("clinic_members")
      .select("professional_id")
      .eq("clinic_id", clinicId)
      .eq("user_id", userId ?? "")
      .maybeSingle(),
  ]);

  return {
    patients: patients ?? [],
    professionals,
    defaultProfessionalId: membership?.professional_id ?? professionals[0]?.id,
    pageMeta: buildPageMeta(count ?? 0, page, PAMI_PATIENTS_PAGE_SIZE),
    searchQuery: q,
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";

import type { PageMeta } from "@/core/supabase/pagination";
import {
  buildPageMeta,
  offsetRange,
  PAMI_PATIENTS_PAGE_SIZE,
} from "@/core/supabase/pagination";
import type { ProfessionalListRow } from "@/core/supabase/query-types";

import { applyPatientSearchFilter } from "@/features/pacientes/utils/patient-search";
import type { PamiPlanillaPatient } from "@/features/pami/types/pami-planilla-entities";
import type { PamiPlanillaCatalog } from "@/features/pami/types/pami-planilla-template";

import { getCachedClinicProfessionalsList, getCachedPamiPlanillaCatalog } from "@/lib/server/cached-clinic-queries";
import { resolveDefaultProfessionalId } from "@/lib/server/resolve-default-professional";

export type { PamiPlanillaPatient };

export type PamiPlanillasPageData = {
  patients: PamiPlanillaPatient[];
  professionals: ProfessionalListRow[];
  catalog: PamiPlanillaCatalog;
  catalogSource: "database" | "fallback";
  defaultProfessionalId: string | undefined;
  pageMeta: PageMeta;
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
  _userId: string | undefined,
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

  const [{ data: patients, count }, professionals, catalogResult] = await Promise.all([
    patientQuery.range(from, to),
    getCachedClinicProfessionalsList(clinicId),
    getCachedPamiPlanillaCatalog(clinicId),
  ]);

  const defaultProfessionalId = await resolveDefaultProfessionalId(
    supabase,
    clinicId,
    professionals
  );

  return {
    patients: patients ?? [],
    professionals,
    catalog: catalogResult.catalog,
    catalogSource: catalogResult.source,
    defaultProfessionalId,
    pageMeta: buildPageMeta(count ?? 0, page, PAMI_PATIENTS_PAGE_SIZE),
    searchQuery: q,
  };
}

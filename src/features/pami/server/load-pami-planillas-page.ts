import type { SupabaseClient } from "@supabase/supabase-js";

import type { PageMeta } from "@/core/supabase/pagination";
import {
  buildPageMeta,
  offsetRange,
  PAMI_PATIENTS_PAGE_SIZE,
} from "@/core/supabase/pagination";
import type { ProfessionalListRow } from "@/core/supabase/query-types";

import {
  type PatientSearchRow,
  searchPatientsForClinicListPage,
} from "@/features/pacientes/server/search-patients";
import { applyPatientSearchFilter } from "@/features/pacientes/utils/patient-search";
import type { PamiPlanillaPatient } from "@/features/pami/types/pami-planilla-entities";
import type { PamiPlanillaCatalog } from "@/features/pami/types/pami-planilla-template";

import { getCachedClinicProfessionalsList, getCachedPamiPlanillaCatalog } from "@/lib/server/cached-clinic-queries";
import { resolveDefaultProfessionalId } from "@/lib/server/resolve-default-professional";

export { buildPamiPlanillasUrl } from "@/features/pami/utils/build-pami-planillas-url";

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

function mapRpcPatient(row: PatientSearchRow): PamiPlanillaPatient {
  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    document_number: row.document_number,
    insurance_number: row.insurance_number ?? null,
    phone: row.phone ?? null,
    address: row.address ?? null,
  };
}

export async function loadPamiPlanillasPageData(
  supabase: SupabaseClient,
  clinicId: string,
  _userId: string | undefined,
  q: string,
  page: number
): Promise<PamiPlanillasPageData> {
  const trimmedQ = q.trim();
  const [professionals, catalogResult] = await Promise.all([
    getCachedClinicProfessionalsList(clinicId),
    getCachedPamiPlanillaCatalog(clinicId),
  ]);

  const defaultProfessionalId = await resolveDefaultProfessionalId(
    supabase,
    clinicId,
    professionals
  );

  if (trimmedQ) {
    const rpcResult = await searchPatientsForClinicListPage(supabase, {
      clinicId,
      q: trimmedQ,
      page,
      pageSize: PAMI_PATIENTS_PAGE_SIZE,
      cobertura: "pami",
    });

    if (!rpcResult.error) {
      return {
        patients: rpcResult.patients.map(mapRpcPatient),
        professionals,
        catalog: catalogResult.catalog,
        catalogSource: catalogResult.source,
        defaultProfessionalId,
        pageMeta: buildPageMeta(rpcResult.total, page, PAMI_PATIENTS_PAGE_SIZE),
        searchQuery: q,
      };
    }
  }

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

  if (trimmedQ) {
    patientQuery = applyPatientSearchFilter(patientQuery, trimmedQ);
  }

  const { from, to } = offsetRange(page, PAMI_PATIENTS_PAGE_SIZE);
  const { data: patients, count } = await patientQuery.range(from, to);

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

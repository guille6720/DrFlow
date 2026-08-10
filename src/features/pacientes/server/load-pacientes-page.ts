import type { SupabaseClient } from "@supabase/supabase-js";

import { observeQuery } from "@/core/observability/observe-query";
import { PACIENTES_PAGE_SIZE } from "@/core/supabase/pagination";

import {
  findPatientIdsByTextSearch,
  type PatientSearchRow,
  searchPatientsForClinicListPage,
} from "@/features/pacientes/server/search-patients";
import {
  buildPacientesPageQuery,
  buildPacientesSearchUrl,
  resolvePacientesClearHref,
} from "@/features/pacientes/utils/pacientes-page-url";
import { applyPatientSearchFilter, findPatientIdsByPathologySearch } from "@/features/pacientes/utils/patient-search";

import { batchPatientRecordCounts } from "@/lib/utils/batch-patient-record-counts";
import { getPortalContextForClinic } from "@/lib/utils/portal-doctor-info";

export { PACIENTES_PAGE_SIZE };

export type PacientesPagePatient = {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  insurance_provider: string | null;
  consultationCount: number;
};

export type PacientesPageData = {
  patients: PacientesPagePatient[];
  total: number;
  portalSlug: string | null;
  doctorInfo: Awaited<ReturnType<typeof getPortalContextForClinic>>["doctorInfo"];
  shareByPatient: Map<
    string,
    { sharedAt: string; sharedByName?: string | null; channel?: string | null }
  >;
  totalPages: number;
  page: number;
};

const EMPTY_PAGE: Omit<PacientesPageData, "page"> = {
  patients: [],
  total: 0,
  portalSlug: null,
  doctorInfo: null,
  shareByPatient: new Map(),
  totalPages: 1,
};

export async function loadPacientesPageData(
  supabase: SupabaseClient,
  clinicId: string | null,
  q: string,
  page: number,
  cobertura?: string,
  patologia?: string
): Promise<PacientesPageData> {
  if (!clinicId) {
    return { ...EMPTY_PAGE, page };
  }

  return observeQuery(
    "load_pacientes_page",
    clinicId,
    async () => loadPacientesPageDataInner(supabase, clinicId, q, page, cobertura, patologia),
    "/pacientes"
  );
}

type RawPatientRow = {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  insurance_provider: string | null;
};

function mapSearchRow(row: PatientSearchRow): RawPatientRow {
  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    document_number: row.document_number,
    birth_date: row.birth_date ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    insurance_provider: row.insurance_provider ?? null,
  };
}

async function enrichPacientesPageRows(
  supabase: SupabaseClient,
  clinicId: string,
  rawPatients: RawPatientRow[],
  portalSlug: string | null
): Promise<{ patients: PacientesPagePatient[]; shareByPatient: PacientesPageData["shareByPatient"] }> {
  const shareByPatient = new Map<
    string,
    { sharedAt: string; sharedByName?: string | null; channel?: string | null }
  >();

  if (rawPatients.length === 0) {
    return { patients: [], shareByPatient };
  }

  const patientIds = rawPatients.map((p) => p.id);
  const [recordCounts, shares] = await Promise.all([
    batchPatientRecordCounts(supabase, clinicId, patientIds),
    portalSlug
      ? supabase
          .from("patient_app_share_log")
          .select("patient_id, shared_at, channel, profiles(full_name)")
          .eq("clinic_id", clinicId)
          .in("patient_id", patientIds)
      : Promise.resolve({ data: [] as Array<{
          patient_id: string;
          shared_at: string;
          channel: string;
          profiles: { full_name?: string } | null;
        }> }),
  ]);

  for (const row of shares.data ?? []) {
    const profileRow = row.profiles as { full_name?: string } | null;
    shareByPatient.set(row.patient_id, {
      sharedAt: row.shared_at,
      sharedByName: profileRow?.full_name ?? null,
      channel: row.channel,
    });
  }

  return {
    patients: rawPatients.map((p) => ({
      ...p,
      consultationCount: recordCounts.get(p.id) ?? 0,
    })),
    shareByPatient,
  };
}

async function loadPacientesPageDataInner(
  supabase: SupabaseClient,
  clinicId: string,
  q: string,
  page: number,
  cobertura?: string,
  patologia?: string
): Promise<PacientesPageData> {
  const portalContext = await getPortalContextForClinic(clinicId);
  const portalSlug = portalContext.portalSlug;
  const doctorInfo = portalContext.doctorInfo;
  const trimmedQ = q.trim();
  const pamiOnly = cobertura === "pami";

  let restrictIds: string[] | null = null;

  if (patologia) {
    const { patientIds, error: pathologyError } = await findPatientIdsByPathologySearch(
      supabase,
      clinicId,
      patologia
    );
    if (pathologyError || patientIds.length === 0) {
      return { ...EMPTY_PAGE, page };
    }
    restrictIds = patientIds;
  }

  if (trimmedQ && restrictIds) {
    const { patientIds: searchIds, error: searchError } = await findPatientIdsByTextSearch(
      supabase,
      clinicId,
      trimmedQ,
      { cobertura: pamiOnly ? "pami" : undefined }
    );
    if (searchError) {
      return { ...EMPTY_PAGE, page };
    }
    const searchSet = new Set(searchIds);
    restrictIds = restrictIds.filter((id) => searchSet.has(id));
    if (restrictIds.length === 0) {
      return { ...EMPTY_PAGE, portalSlug, doctorInfo, page };
    }
  } else if (trimmedQ && !restrictIds) {
    const rpcResult = await searchPatientsForClinicListPage(supabase, {
      clinicId,
      q: trimmedQ,
      page,
      pageSize: PACIENTES_PAGE_SIZE,
      cobertura: pamiOnly ? "pami" : undefined,
    });

    if (!rpcResult.error) {
      const rawPatients = rpcResult.patients.map(mapSearchRow);
      const { patients, shareByPatient } = await enrichPacientesPageRows(
        supabase,
        clinicId,
        rawPatients,
        portalSlug
      );
      const total = rpcResult.total;
      return {
        patients,
        total,
        portalSlug,
        doctorInfo,
        shareByPatient,
        totalPages: Math.max(1, Math.ceil(total / PACIENTES_PAGE_SIZE)),
        page,
      };
    }
  }

  let query = supabase
    .from("patients")
    .select(
      "id, first_name, last_name, document_number, birth_date, phone, email, insurance_provider",
      { count: "exact" }
    )
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .order("last_name")
    .order("first_name");

  if (restrictIds) {
    query = query.in("id", restrictIds);
  }

  if (trimmedQ && restrictIds) {
    // Pathology + text search already intersected via RPC IDs.
  } else if (trimmedQ) {
    query = applyPatientSearchFilter(query, trimmedQ);
  }

  if (pamiOnly) {
    query = query.ilike("insurance_provider", "%PAMI%");
  }

  const from = (page - 1) * PACIENTES_PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + PACIENTES_PAGE_SIZE - 1);

  if (error) {
    return { ...EMPTY_PAGE, page };
  }

  const rawPatients = (data ?? []) as RawPatientRow[];
  const total = count ?? 0;
  const { patients, shareByPatient } = await enrichPacientesPageRows(
    supabase,
    clinicId,
    rawPatients,
    portalSlug
  );

  return {
    patients,
    total,
    portalSlug,
    doctorInfo,
    shareByPatient,
    totalPages: Math.max(1, Math.ceil(total / PACIENTES_PAGE_SIZE)),
    page,
  };
}

export { buildPacientesPageQuery, buildPacientesSearchUrl, resolvePacientesClearHref };

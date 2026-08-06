import type { SupabaseClient } from "@supabase/supabase-js";

import { observeQuery } from "@/core/observability/observe-query";
import { PACIENTES_PAGE_SIZE } from "@/core/supabase/pagination";

import {
  buildPacientesPageQuery,
  buildPacientesSearchUrl,
  resolvePacientesClearHref,
} from "@/features/pacientes/utils/pacientes-page-url";
import { applyPatientSearchFilter, findPatientIdsByPathologySearch } from "@/features/pacientes/utils/patient-search";

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

export async function loadPacientesPageData(
  supabase: SupabaseClient,
  clinicId: string | null,
  q: string,
  page: number,
  cobertura?: string,
  patologia?: string
): Promise<PacientesPageData> {
  if (!clinicId) {
    return {
      patients: [],
      total: 0,
      portalSlug: null,
      doctorInfo: null,
      shareByPatient: new Map(),
      totalPages: 1,
      page,
    };
  }

  return observeQuery(
    "load_pacientes_page",
    clinicId,
    async () => loadPacientesPageDataInner(supabase, clinicId, q, page, cobertura, patologia),
    "/pacientes"
  );
}

async function loadPacientesPageDataInner(
  supabase: SupabaseClient,
  clinicId: string,
  q: string,
  page: number,
  cobertura?: string,
  patologia?: string
): Promise<PacientesPageData> {
  let patients: PacientesPagePatient[] = [];
  let total = 0;
  let portalSlug: string | null = null;
  let doctorInfo: PacientesPageData["doctorInfo"] = null;
  const shareByPatient = new Map<
    string,
    { sharedAt: string; sharedByName?: string | null; channel?: string | null }
  >();

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

    if (patologia) {
      const { patientIds, error: pathologyError } = await findPatientIdsByPathologySearch(
        supabase,
        clinicId,
        patologia
      );
      if (pathologyError) {
        return {
          patients: [],
          total: 0,
          portalSlug: null,
          doctorInfo: null,
          shareByPatient: new Map(),
          totalPages: 1,
          page,
        };
      }
      if (patientIds.length === 0) {
        return {
          patients: [],
          total: 0,
          portalSlug: null,
          doctorInfo: null,
          shareByPatient: new Map(),
          totalPages: 1,
          page,
        };
      }
      query = query.in("id", patientIds);
    }

    if (q) {
      query = applyPatientSearchFilter(query, q);
    }
    if (cobertura === "pami") {
      query = query.ilike("insurance_provider", "%PAMI%");
    }

    const from = (page - 1) * PACIENTES_PAGE_SIZE;
    const [{ data, count, error }, portalContext] = await Promise.all([
      query.range(from, from + PACIENTES_PAGE_SIZE - 1),
      getPortalContextForClinic(clinicId),
    ]);
    if (error) {
      return {
        patients: [],
        total: 0,
        portalSlug: null,
        doctorInfo: null,
        shareByPatient: new Map(),
        totalPages: 1,
        page,
      };
    }
    patients = data ?? [];
    total = count ?? 0;
    portalSlug = portalContext.portalSlug;
    doctorInfo = portalContext.doctorInfo;

    if (patients.length > 0 && portalSlug) {
      const { data: shares } = await supabase
        .from("patient_app_share_log")
        .select("patient_id, shared_at, channel, profiles(full_name)")
        .eq("clinic_id", clinicId)
        .in(
          "patient_id",
          patients.map((p) => p.id)
        );

      for (const row of shares ?? []) {
        const profileRow = row.profiles as { full_name?: string } | null;
        shareByPatient.set(row.patient_id, {
          sharedAt: row.shared_at,
          sharedByName: profileRow?.full_name ?? null,
          channel: row.channel,
        });
      }
    }

  const totalPages = Math.max(1, Math.ceil(total / PACIENTES_PAGE_SIZE));

  return {
    patients,
    total,
    portalSlug,
    doctorInfo,
    shareByPatient,
    totalPages,
    page,
  };
}

export { buildPacientesPageQuery, buildPacientesSearchUrl, resolvePacientesClearHref };

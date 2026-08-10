import type { SupabaseClient } from "@supabase/supabase-js";

import { HISTORIAS_PAGE_SIZE } from "@/core/supabase/pagination";

import type { PatientRecordGroup } from "@/features/historias/components/historias/clinical-records-grouped-list";
import { searchPatientsForClinic } from "@/features/pacientes/server/search-patients";

import { batchPatientRecordCounts } from "@/lib/utils/batch-patient-record-counts";
import type { ClinicalRecordListRow } from "@/lib/utils/clinical-record-list-types";

export { HISTORIAS_PAGE_SIZE };

export function buildHistoriasUrl(params: { q?: string; page?: number }) {
  const parts = new URLSearchParams();
  parts.set("seccion", "historias");
  if (params.q) parts.set("q", params.q);
  if (params.page && params.page > 1) parts.set("page", String(params.page));
  return `/pacientes?${parts.toString()}`;
}

export type HistoriasPageData = {
  records: ClinicalRecordListRow[];
  listTitle: string;
  noMatchPatients: boolean;
  totalRecords: number;
  clinicTotalRecords: number;
  groups: PatientRecordGroup[];
  singlePatientFromSearch: string | null;
  totalPages: number;
  safePage: number;
};

export async function loadHistoriasPageData(
  supabase: SupabaseClient,
  clinicId: string | null,
  q: string,
  page: number
): Promise<HistoriasPageData> {
  let records: ClinicalRecordListRow[] = [];
  let listTitle = "Consultas recientes";
  let noMatchPatients = false;
  let totalRecords = 0;
  let clinicTotalRecords = 0;

  if (clinicId) {
    let patientIds: string[] | null = null;

    if (q) {
      const { patients: matchedPatients, error: searchError } = await searchPatientsForClinic(
        supabase,
        { clinicId, q, limit: 50 }
      );
      if (searchError) {
        noMatchPatients = true;
      } else if (!matchedPatients.length) {
        noMatchPatients = true;
      } else {
        const matched = matchedPatients.map((p) => ({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          document_number: p.document_number,
        }));
        patientIds = matched.map((p) => p.id);
        if (matched.length === 1) {
          listTitle = `Resultados · ${matched[0].last_name}, ${matched[0].first_name}`;
        } else {
          listTitle = `Resultados · ${matched.length} pacientes (búsqueda: ${q})`;
        }
      }
    } else {
      listTitle = "Últimas consultas de la clínica";
    }

    if (!noMatchPatients) {
      const selectFields =
        "id, patient_id, diagnosis, chief_complaint, created_at, patients(first_name, last_name, phone, document_number), professionals(profiles(full_name))";

      const clinicCountPromise = supabase
        .from("clinical_records")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId);

      let recordsQuery = supabase
        .from("clinical_records")
        .select(selectFields, { count: "exact" })
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false });

      if (patientIds) {
        recordsQuery = recordsQuery.in("patient_id", patientIds);
      }

      const from = (page - 1) * HISTORIAS_PAGE_SIZE;
      const [{ count: clinicCount }, { data, count }] = await Promise.all([
        clinicCountPromise,
        recordsQuery.range(from, from + HISTORIAS_PAGE_SIZE - 1),
      ]);

      clinicTotalRecords = clinicCount ?? 0;
      records = (data ?? []) as unknown as ClinicalRecordListRow[];
      totalRecords = count ?? 0;
    } else {
      const { count: clinicCount } = await supabase
        .from("clinical_records")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId);
      clinicTotalRecords = clinicCount ?? 0;
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalRecords / HISTORIAS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const uniquePatientIds = [...new Set(records.map((r) => r.patient_id as string))];
  const patientCountCache =
    clinicId && uniquePatientIds.length > 0
      ? await batchPatientRecordCounts(supabase, clinicId, uniquePatientIds)
      : new Map<string, number>();

  const groupsMap = new Map<string, PatientRecordGroup>();
  for (const r of records) {
    const pid = r.patient_id as string;
    const p = r.patients as {
      first_name: string;
      last_name: string;
      phone: string | null;
      document_number: string;
    } | null;
    if (!groupsMap.has(pid)) {
      groupsMap.set(pid, {
        patientId: pid,
        firstName: p?.first_name ?? "Paciente",
        lastName: p?.last_name ?? "",
        documentNumber: p?.document_number ?? "—",
        phone: p?.phone ?? null,
        records: [],
        totalForPatient: patientCountCache.get(pid) ?? 0,
      });
    }
    groupsMap.get(pid)!.records.push({
      id: r.id,
      created_at: r.created_at,
      diagnosis: r.diagnosis,
      chief_complaint: r.chief_complaint,
      professional_name: r.professionals?.profiles?.full_name ?? "Profesional",
    });
  }

  const groups = [...groupsMap.values()].sort((a, b) =>
    `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`, "es")
  );

  for (const g of groups) {
    g.records.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  const singlePatientFromSearch = q && groups.length === 1 ? groups[0].patientId : null;

  return {
    records,
    listTitle,
    noMatchPatients,
    totalRecords,
    clinicTotalRecords,
    groups,
    singlePatientFromSearch,
    totalPages,
    safePage,
  };
}

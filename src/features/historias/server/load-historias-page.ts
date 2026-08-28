import type { SupabaseClient } from "@supabase/supabase-js";

import {
  descCursorNewerThanFilter,
  descCursorOlderThanFilter,
  encodeDescCursor,
  HISTORIAS_PAGE_SIZE,
  KEYSET_OFFSET_FALLBACK_MAX_PAGE,
  parseDescCursor,
} from "@/core/supabase/pagination";

import type { PatientRecordGroup } from "@/features/historias/components/historias/clinical-records-grouped-list";
import { searchPatientsForClinic } from "@/features/pacientes/server/search-patients";

import { batchPatientConsultationCounts } from "@/lib/utils/batch-patient-record-counts";
import type { ClinicalRecordListRow } from "@/lib/utils/clinical-record-list-types";

export { HISTORIAS_PAGE_SIZE };

export function buildHistoriasUrl(params: {
  q?: string;
  page?: number;
  cursor?: string | null;
  before?: string | null;
}) {
  const parts = new URLSearchParams();
  parts.set("seccion", "historias");
  if (params.q) parts.set("q", params.q);
  if (params.page && params.page > 1) parts.set("page", String(params.page));
  if (params.cursor) parts.set("cursor", params.cursor);
  if (params.before) parts.set("before", params.before);
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
  /** Keyset cursor for the next (older) page — exclusive. */
  nextCursor: string | null;
  /** Keyset cursor for the previous (newer) page — exclusive via `before`. */
  prevCursor: string | null;
  paginationMode: "keyset" | "offset_fallback" | "empty" | "cursor_required" | "invalid_cursor";
  /**
   * Controlled pagination contract error — never silently returns page-1 data
   * when a deep page was requested without a valid cursor.
   */
  paginationError: string | null;
};

const SELECT_FIELDS =
  "id, patient_id, diagnosis, chief_complaint, created_at, patients(first_name, last_name, phone, document_number), professionals(profiles(full_name))";

export async function loadHistoriasPageData(
  supabase: SupabaseClient,
  clinicId: string | null,
  q: string,
  page: number,
  options?: { cursor?: string | null; before?: string | null }
): Promise<HistoriasPageData> {
  let records: ClinicalRecordListRow[] = [];
  let listTitle = "Consultas recientes";
  let noMatchPatients = false;
  let totalRecords = 0;
  let clinicTotalRecords = 0;
  let nextCursor: string | null = null;
  let prevCursor: string | null = null;
  let paginationMode: HistoriasPageData["paginationMode"] = "empty";
  let paginationError: string | null = null;
  let effectivePage = Math.max(1, page);

  const rawCursor = options?.cursor?.trim() || null;
  const rawBefore = options?.before?.trim() || null;
  const afterCursor = parseDescCursor(rawCursor);
  const beforeCursor = parseDescCursor(rawBefore);

  // Invalid cursor/before strings → controlled contract error (no silent page-1 data).
  if ((rawCursor && !afterCursor) || (rawBefore && !beforeCursor)) {
    paginationMode = "invalid_cursor";
    paginationError =
      "El enlace de paginación no es válido. Volvé a la primera página e intentá de nuevo.";
    return {
      records: [],
      listTitle,
      noMatchPatients: false,
      totalRecords: 0,
      clinicTotalRecords: 0,
      groups: [],
      singlePatientFromSearch: null,
      totalPages: 1,
      safePage: 1,
      nextCursor: null,
      prevCursor: null,
      paginationMode,
      paginationError,
    };
  }

  // Deep page without keyset cursor → controlled response (never clamp to page-1 rows).
  if (
    !afterCursor &&
    !beforeCursor &&
    effectivePage > KEYSET_OFFSET_FALLBACK_MAX_PAGE
  ) {
    paginationMode = "cursor_required";
    paginationError =
      "Para ver páginas más profundas usá Siguiente/Anterior (paginación por cursor). La página solicitada no puede resolverse por OFFSET.";
    if (clinicId) {
      const { count: clinicCount } = await supabase
        .from("clinical_records")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId);
      clinicTotalRecords = clinicCount ?? 0;
      totalRecords = clinicTotalRecords;
    }
    const totalPages = Math.max(1, Math.ceil(totalRecords / HISTORIAS_PAGE_SIZE));
    return {
      records: [],
      listTitle,
      noMatchPatients: false,
      totalRecords,
      clinicTotalRecords,
      groups: [],
      singlePatientFromSearch: null,
      totalPages,
      safePage: Math.min(effectivePage, totalPages),
      nextCursor: null,
      prevCursor: null,
      paginationMode,
      paginationError,
    };
  }

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
      const clinicCountPromise = supabase
        .from("clinical_records")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId);

      const fetchLimit = HISTORIAS_PAGE_SIZE + 1;

      let recordsQuery = supabase
        .from("clinical_records")
        .select(SELECT_FIELDS, { count: "exact" })
        .eq("clinic_id", clinicId);

      if (patientIds) {
        recordsQuery = recordsQuery.in("patient_id", patientIds);
      }

      if (beforeCursor) {
        // Walk newer rows (prev page): ASC then reverse.
        paginationMode = "keyset";
        recordsQuery = recordsQuery
          .or(descCursorNewerThanFilter(beforeCursor))
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .limit(fetchLimit);
      } else if (afterCursor) {
        paginationMode = "keyset";
        recordsQuery = recordsQuery
          .or(descCursorOlderThanFilter(afterCursor))
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(fetchLimit);
      } else if (effectivePage > 1 && effectivePage <= KEYSET_OFFSET_FALLBACK_MAX_PAGE) {
        // Shallow OFFSET only — deep pages require cursor (handled above).
        paginationMode = "offset_fallback";
        const from = (effectivePage - 1) * HISTORIAS_PAGE_SIZE;
        recordsQuery = recordsQuery
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, from + HISTORIAS_PAGE_SIZE - 1);
      } else {
        // Page 1 only (keyset without cursor).
        paginationMode = "keyset";
        effectivePage = 1;
        recordsQuery = recordsQuery
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(fetchLimit);
      }

      const [{ count: clinicCount }, { data, count }] = await Promise.all([
        clinicCountPromise,
        recordsQuery,
      ]);

      clinicTotalRecords = clinicCount ?? 0;
      totalRecords = count ?? 0;

      let rows = (data ?? []) as unknown as ClinicalRecordListRow[];

      if (beforeCursor) {
        const hasMoreNewer = rows.length > HISTORIAS_PAGE_SIZE;
        if (hasMoreNewer) rows = rows.slice(0, HISTORIAS_PAGE_SIZE);
        rows = [...rows].reverse();
        const first = rows[0];
        const last = rows.at(-1);
        // More older content always exists when walking back from a before-cursor
        // (unless we somehow landed on the end); next = older than last.
        nextCursor = last ? encodeDescCursor(last.created_at, last.id) : null;
        prevCursor = hasMoreNewer && first ? encodeDescCursor(first.created_at, first.id) : null;
      } else if (paginationMode === "offset_fallback") {
        records = rows;
        const first = rows[0];
        const last = rows.at(-1);
        nextCursor =
          rows.length === HISTORIAS_PAGE_SIZE && last
            ? encodeDescCursor(last.created_at, last.id)
            : null;
        prevCursor =
          effectivePage > 1 && first ? encodeDescCursor(first.created_at, first.id) : null;
      } else {
        const hasMoreOlder = rows.length > HISTORIAS_PAGE_SIZE;
        if (hasMoreOlder) rows = rows.slice(0, HISTORIAS_PAGE_SIZE);
        const first = rows[0];
        const last = rows.at(-1);
        nextCursor =
          hasMoreOlder && last ? encodeDescCursor(last.created_at, last.id) : null;
        prevCursor =
          (afterCursor || effectivePage > 1) && first
            ? encodeDescCursor(first.created_at, first.id)
            : null;
      }

      records = rows;
    } else {
      const { count: clinicCount } = await supabase
        .from("clinical_records")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId);
      clinicTotalRecords = clinicCount ?? 0;
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalRecords / HISTORIAS_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, effectivePage), totalPages);

  const uniquePatientIds = [...new Set(records.map((r) => r.patient_id as string))];
  const patientCountCache =
    clinicId && uniquePatientIds.length > 0
      ? await batchPatientConsultationCounts(supabase, clinicId, uniquePatientIds)
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
    nextCursor,
    prevCursor,
    paginationMode,
    paginationError,
  };
}

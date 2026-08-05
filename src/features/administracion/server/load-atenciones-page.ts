import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ATENCIONES_PAGE_SIZE,
  buildPageMeta,
  offsetRange,
  parsePageParam,
} from "@/core/supabase/pagination";

import type { ConsultationModality } from "@/lib/constants/consultation-modality";
import type { AttendanceListItem, AttendancePeriod, AttendanceSummary } from "@/lib/utils/attendance-stats";
import { getAttendancePeriodBounds } from "@/lib/utils/attendance-stats";

export { ATENCIONES_PAGE_SIZE, parsePageParam as parseAtencionesPage };

export type AtencionesPageData = {
  period: AttendancePeriod;
  periodLabel: string;
  summary: AttendanceSummary;
  items: AttendanceListItem[];
  pageMeta: ReturnType<typeof buildPageMeta>;
};

type RpcSummary = {
  total: number;
  presencial: number;
  virtual: number;
  unique_patients: number;
  by_coverage: Array<{ coverage: string; count: number }>;
};

function mapRpcSummary(raw: RpcSummary | null): AttendanceSummary {
  if (!raw) {
    return { total: 0, presencial: 0, virtual: 0, uniquePatients: 0, byCoverage: [] };
  }
  return {
    total: raw.total ?? 0,
    presencial: raw.presencial ?? 0,
    virtual: raw.virtual ?? 0,
    uniquePatients: raw.unique_patients ?? 0,
    byCoverage: (raw.by_coverage ?? []).map((row) => ({
      coverage: row.coverage,
      count: row.count,
    })),
  };
}

export function buildAtencionesUrl(period: AttendancePeriod, page = 1): string {
  const params = new URLSearchParams({ period });
  if (page > 1) params.set("page", String(page));
  return `/atenciones?${params.toString()}`;
}

export async function loadAtencionesPageData(
  supabase: SupabaseClient,
  clinicId: string | null,
  period: AttendancePeriod,
  page: number,
  timeZone: string
): Promise<AtencionesPageData> {
  const { start, end, label } = getAttendancePeriodBounds(period, new Date(), timeZone);

  if (!clinicId) {
    return {
      period,
      periodLabel: label,
      summary: mapRpcSummary(null),
      items: [],
      pageMeta: buildPageMeta(0, 1, ATENCIONES_PAGE_SIZE),
    };
  }

  const { from, to } = offsetRange(page, ATENCIONES_PAGE_SIZE);

  const [summaryRes, listRes] = await Promise.all([
    supabase.rpc("summarize_attended_appointments", {
      p_clinic_id: clinicId,
      p_start: start.toISOString(),
      p_end: end.toISOString(),
    }),
    supabase
      .from("appointments")
      .select(
        "id, start_at, consultation_modality, patient_id, patients(first_name, last_name, insurance_provider), professionals(profiles(full_name))",
        { count: "exact" }
      )
      .eq("clinic_id", clinicId)
      .eq("status", "attended")
      .gte("start_at", start.toISOString())
      .lt("start_at", end.toISOString())
      .order("start_at", { ascending: false })
      .range(from, to),
  ]);

  const summary = mapRpcSummary(summaryRes.data as RpcSummary | null);
  const total = listRes.count ?? summary.total;

  const items: AttendanceListItem[] = (listRes.data ?? []).map((row) => {
    const patients = row.patients as unknown as {
      first_name: string;
      last_name: string;
      insurance_provider?: string | null;
    } | null;
    const professionals = row.professionals as unknown as {
      profiles?: { full_name?: string } | null;
    } | null;

    return {
      id: row.id,
      start_at: row.start_at,
      consultation_modality:
        (row.consultation_modality as ConsultationModality | null) ?? "presencial",
      patientId: row.patient_id,
      patientName: patients
        ? `${patients.last_name}, ${patients.first_name}`
        : "Paciente",
      professionalName: professionals?.profiles?.full_name ?? "Profesional",
      coverage: patients?.insurance_provider?.trim() || "Sin cobertura",
    };
  });

  return {
    period,
    periodLabel: label,
    summary,
    items,
    pageMeta: buildPageMeta(total, page, ATENCIONES_PAGE_SIZE),
  };
}

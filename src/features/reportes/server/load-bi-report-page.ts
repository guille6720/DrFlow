import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type BiPeriod,
  type ClinicBiReport,
  emptyClinicBiReport,
} from "@/features/reportes/utils/bi-report";

import { getAttendancePeriodBounds } from "@/lib/utils/attendance-stats";

export type BiReportPageData = {
  period: BiPeriod;
  periodLabel: string;
  report: ClinicBiReport;
};

function mapBiReport(raw: Record<string, unknown> | null): ClinicBiReport {
  if (!raw) return emptyClinicBiReport();

  const stats = (raw.appointment_stats as Record<string, unknown>) ?? {};

  return {
    attended_total: Number(raw.attended_total ?? 0),
    unique_coverages: Number(raw.unique_coverages ?? 0),
    unique_specialties: Number(raw.unique_specialties ?? 0),
    appointment_stats: {
      total_scheduled: Number(stats.total_scheduled ?? 0),
      attended: Number(stats.attended ?? 0),
      no_show: Number(stats.no_show ?? 0),
      cancelled: Number(stats.cancelled ?? 0),
      presencial: Number(stats.presencial ?? 0),
      virtual: Number(stats.virtual ?? 0),
      attendance_rate: Number(stats.attendance_rate ?? 0),
    },
    by_coverage: ((raw.by_coverage as Array<Record<string, unknown>>) ?? []).map((row) => ({
      coverage: String(row.coverage ?? ""),
      count: Number(row.count ?? 0),
      pct: Number(row.pct ?? 0),
    })),
    by_specialty: ((raw.by_specialty as Array<Record<string, unknown>>) ?? []).map((row) => ({
      specialty: String(row.specialty ?? ""),
      count: Number(row.count ?? 0),
      pct: Number(row.pct ?? 0),
    })),
    by_specialty_coverage: ((raw.by_specialty_coverage as Array<Record<string, unknown>>) ?? []).map(
      (row) => ({
        specialty: String(row.specialty ?? ""),
        coverage: String(row.coverage ?? ""),
        count: Number(row.count ?? 0),
      })
    ),
    by_location: ((raw.by_location as Array<Record<string, unknown>>) ?? []).map((row) => ({
      location: String(row.location ?? ""),
      count: Number(row.count ?? 0),
      pct: Number(row.pct ?? 0),
    })),
  };
}

export async function loadBiReportPageData(
  supabase: SupabaseClient,
  clinicId: string | null,
  period: BiPeriod,
  timeZone: string
): Promise<BiReportPageData> {
  const { start, end, label } = getAttendancePeriodBounds(period, new Date(), timeZone);

  if (!clinicId) {
    return { period, periodLabel: label, report: emptyClinicBiReport() };
  }

  const { data, error } = await supabase.rpc("summarize_clinic_bi", {
    p_clinic_id: clinicId,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
  });

  if (error) {
    return { period, periodLabel: label, report: emptyClinicBiReport() };
  }

  return {
    period,
    periodLabel: label,
    report: mapBiReport(data as Record<string, unknown>),
  };
}

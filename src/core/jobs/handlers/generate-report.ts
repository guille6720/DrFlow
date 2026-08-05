import type { SupabaseClient } from "@supabase/supabase-js";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";

import type { ClinicJobRow, GenerateReportJobPayload } from "@/core/jobs/types";

import { loadMonthlyClinicReport } from "@/lib/server/load-monthly-clinic-report";

export async function handleGenerateReportJob(
  supabase: SupabaseClient,
  job: ClinicJobRow
): Promise<Record<string, unknown>> {
  const payload = job.payload as unknown as GenerateReportJobPayload;
  const clinicId = job.clinic_id;

  const monthStart = payload.periodStart ?? startOfMonth(new Date()).toISOString();
  const monthEnd = payload.periodEnd ?? endOfMonth(new Date()).toISOString();
  const periodLabel =
    payload.periodLabel ?? format(new Date(monthStart), "MMMM yyyy", { locale: es });

  const report = await loadMonthlyClinicReport(
    supabase,
    clinicId,
    monthStart,
    monthEnd,
    periodLabel
  );

  return {
    periodLabel,
    totalAppointments: report.totalAppointments,
    noShow: report.noShow,
    cancelled: report.cancelled,
    newPatients: report.newPatients,
    estimatedRevenue: report.estimatedRevenue,
    csvRows: report.csvRows,
  };
}

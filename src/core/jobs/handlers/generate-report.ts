import type { SupabaseClient } from "@supabase/supabase-js";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { es } from "date-fns/locale";
import type { ClinicJobRow, GenerateReportJobPayload } from "@/core/jobs/types";

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

  const [appts, noShow, cancelled, newPats, records, payments] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, status, start_at, professionals(profiles(full_name))")
      .eq("clinic_id", clinicId)
      .gte("start_at", monthStart)
      .lte("start_at", monthEnd),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("status", "no_show")
      .gte("start_at", monthStart),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("status", "cancelled")
      .gte("start_at", monthStart),
    supabase
      .from("patients")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .gte("created_at", monthStart),
    supabase
      .from("clinical_records")
      .select("id, professional_id, professionals(profiles(full_name))")
      .eq("clinic_id", clinicId)
      .gte("created_at", monthStart),
    supabase
      .from("payments")
      .select("amount")
      .eq("clinic_id", clinicId)
      .eq("status", "paid")
      .gte("created_at", monthStart),
  ]);

  const doctorCounts = new Map<string, number>();
  for (const r of records.data ?? []) {
    const name =
      (r.professionals as unknown as { profiles?: { full_name?: string } })?.profiles
        ?.full_name ?? "Sin asignar";
    doctorCounts.set(name, (doctorCounts.get(name) ?? 0) + 1);
  }

  const revenue = (payments.data ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  const csvRows: string[][] = [
    ["Métrica", "Valor", "Período"],
    ["Turnos totales", String(appts.data?.length ?? 0), periodLabel],
    ["Ausentismo", String(noShow.count ?? 0), periodLabel],
    ["Cancelaciones", String(cancelled.count ?? 0), periodLabel],
    ["Pacientes nuevos", String(newPats.count ?? 0), periodLabel],
    ["Ingresos estimados", String(revenue), periodLabel],
    ...Array.from(doctorCounts.entries()).map(([name, count]) => [
      `Consultas - ${name}`,
      String(count),
      periodLabel,
    ]),
  ];

  return {
    periodLabel,
    totalAppointments: appts.data?.length ?? 0,
    noShow: noShow.count ?? 0,
    cancelled: cancelled.count ?? 0,
    newPatients: newPats.count ?? 0,
    estimatedRevenue: revenue,
    csvRows,
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";

export type MonthlyClinicReport = {
  totalAppointments: number;
  noShow: number;
  cancelled: number;
  newPatients: number;
  consultationsByDoctor: Array<{ name: string; count: number }>;
  estimatedRevenue: number;
  csvRows: string[][];
};

async function sumPaidPayments(
  supabase: SupabaseClient,
  clinicId: string,
  monthStart: string,
  monthEnd: string
): Promise<number> {
  const { data, error } = await supabase.rpc("sum_paid_payments", {
    p_clinic_id: clinicId,
    p_from: monthStart,
    p_to: monthEnd,
  });

  if (!error && data != null) return Number(data);

  const { data: payments } = await supabase
    .from("payments")
    .select("amount")
    .eq("clinic_id", clinicId)
    .eq("status", "paid")
    .gte("created_at", monthStart);

  return (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
}

/** Shared monthly analytics bundle for reportes page and background jobs. */
export async function loadMonthlyClinicReport(
  supabase: SupabaseClient,
  clinicId: string,
  monthStart: string,
  monthEnd: string,
  periodLabel: string
): Promise<MonthlyClinicReport> {
  const [totalAppts, noShow, cancelled, newPats, _recordsCount, revenue, recordsByDoctor] = await Promise.all([
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
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
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .gte("created_at", monthStart)
      .lte("created_at", monthEnd),
    sumPaidPayments(supabase, clinicId, monthStart, monthEnd),
    supabase.rpc("count_clinical_records_by_professional", {
      p_clinic_id: clinicId,
      p_from: monthStart,
      p_to: monthEnd,
    }),
  ]);

  const doctorRows = (recordsByDoctor.data ?? []) as Array<{ name: string; count: number }>;
  const consultationsByDoctor = doctorRows.map((row) => ({
    name: row.name,
    count: row.count,
  }));
  const totalAppointments = totalAppts.count ?? 0;

  const csvRows: string[][] = [
    ["Métrica", "Valor", "Período"],
    ["Turnos totales", String(totalAppointments), periodLabel],
    ["Ausentismo", String(noShow.count ?? 0), periodLabel],
    ["Cancelaciones", String(cancelled.count ?? 0), periodLabel],
    ["Pacientes nuevos", String(newPats.count ?? 0), periodLabel],
    ["Ingresos estimados", String(revenue), periodLabel],
    ...consultationsByDoctor.map(({ name, count }) => [
      `Consultas - ${name}`,
      String(count),
      periodLabel,
    ]),
  ];

  return {
    totalAppointments,
    noShow: noShow.count ?? 0,
    cancelled: cancelled.count ?? 0,
    newPatients: newPats.count ?? 0,
    consultationsByDoctor,
    estimatedRevenue: revenue,
    csvRows,
  };
}

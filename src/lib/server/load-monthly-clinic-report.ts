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
  const [totalAppts, noShow, cancelled, newPats, records, revenue] = await Promise.all([
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
      .select("id, professional_id, professionals(profiles(full_name))")
      .eq("clinic_id", clinicId)
      .gte("created_at", monthStart),
    sumPaidPayments(supabase, clinicId, monthStart, monthEnd),
  ]);

  const doctorCounts = new Map<string, number>();
  for (const record of records.data ?? []) {
    const name =
      (record.professionals as unknown as { profiles?: { full_name?: string } })?.profiles
        ?.full_name ?? "Sin asignar";
    doctorCounts.set(name, (doctorCounts.get(name) ?? 0) + 1);
  }

  const totalAppointments = totalAppts.count ?? 0;
  const consultationsByDoctor = Array.from(doctorCounts.entries()).map(([name, count]) => ({
    name,
    count,
  }));

  const csvRows: string[][] = [
    ["Métrica", "Valor", "Período"],
    ["Turnos totales", String(totalAppointments), periodLabel],
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
    totalAppointments,
    noShow: noShow.count ?? 0,
    cancelled: cancelled.count ?? 0,
    newPatients: newPats.count ?? 0,
    consultationsByDoctor,
    estimatedRevenue: revenue,
    csvRows,
  };
}

import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import {
  getActiveClinicId,
  getProfile,
  getUserClinics,
  getActiveClinic,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions/roles";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { es } from "date-fns/locale";
import { ExportCsvButton } from "@/components/reportes/export-csv-button";
import { formatCurrency } from "@/lib/services/payments";

export default async function ReportesPage() {
  const profile = await getProfile();
  const clinics = await getUserClinics();
  const clinicId = await getActiveClinicId();
  const { role, isSuperadmin } = await getActiveClinic();

  if (!hasPermission(role, "viewReports", isSuperadmin)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const now = new Date();
  const monthStart = startOfMonth(now).toISOString();
  const monthEnd = endOfMonth(now).toISOString();
  const periodLabel = format(now, "MMMM yyyy", { locale: es });

  let report = {
    totalAppointments: 0,
    noShow: 0,
    cancelled: 0,
    newPatients: 0,
    consultationsByDoctor: [] as { name: string; count: number }[],
    estimatedRevenue: 0,
    csvRows: [] as string[][],
  };

  if (clinicId) {
    const [appts, noShow, cancelled, newPats, records, payments] = await Promise.all([
      supabase.from("appointments").select("id, status, start_at, professionals(profiles(full_name))").eq("clinic_id", clinicId).gte("start_at", monthStart).lte("start_at", monthEnd),
      supabase.from("appointments").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("status", "no_show").gte("start_at", monthStart),
      supabase.from("appointments").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("status", "cancelled").gte("start_at", monthStart),
      supabase.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).gte("created_at", monthStart),
      supabase.from("clinical_records").select("id, professional_id, professionals(profiles(full_name))").eq("clinic_id", clinicId).gte("created_at", monthStart),
      supabase.from("payments").select("amount").eq("clinic_id", clinicId).eq("status", "paid").gte("created_at", monthStart),
    ]);

    const doctorCounts = new Map<string, number>();
    for (const r of records.data ?? []) {
      const name = (r.professionals as unknown as { profiles?: { full_name?: string } })?.profiles?.full_name ?? "Sin asignar";
      doctorCounts.set(name, (doctorCounts.get(name) ?? 0) + 1);
    }

    const revenue = (payments.data ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

    report = {
      totalAppointments: appts.data?.length ?? 0,
      noShow: noShow.count ?? 0,
      cancelled: cancelled.count ?? 0,
      newPatients: newPats.count ?? 0,
      consultationsByDoctor: Array.from(doctorCounts.entries()).map(([name, count]) => ({ name, count })),
      estimatedRevenue: revenue,
      csvRows: [
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
      ],
    };
  }

  return (
    <>
      <Header
        title="Reportes operativos"
        subtitle={`Período: ${periodLabel}`}
        clinics={clinics}
        activeClinicId={clinicId}
        role={role}
        userName={profile?.full_name}
      />

      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex justify-end">
          <ExportCsvButton rows={report.csvRows} filename={`reporte-${format(now, "yyyy-MM")}.csv`} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard title="Turnos del período" value={report.totalAppointments} />
          <StatCard title="Ausentismo" value={report.noShow} />
          <StatCard title="Cancelaciones" value={report.cancelled} />
          <StatCard title="Pacientes nuevos" value={report.newPatients} />
          <StatCard title="Ingresos estimados" value={formatCurrency(report.estimatedRevenue)} />
        </div>

        <Card title="Consultas por médico">
          {report.consultationsByDoctor.length === 0 ? (
            <p className="text-sm text-slate-500">Sin datos para este período.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {report.consultationsByDoctor.map((d) => (
                <li key={d.name} className="flex justify-between py-2 text-sm">
                  <span>{d.name}</span>
                  <span className="font-semibold">{d.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

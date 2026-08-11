import { endOfMonth, format, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getDashboardPageContext } from "@/core/auth/dashboard-page";
import { Header } from "@/core/components/layout/header";
import { hasPermission } from "@/core/permissions/roles";
import { createClient } from "@/core/supabase/server";

import { AsyncReportButton } from "@/features/dashboard/components/reportes/async-report-button";
import { ExportCsvButton } from "@/features/dashboard/components/reportes/export-csv-button";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { loadMonthlyClinicReport } from "@/lib/server/load-monthly-clinic-report";
import { formatCurrency } from "@/lib/services/payments";

export default async function ReportesPage() {
  const { profile, clinics, clinicId, role, isSuperadmin } = await getDashboardPageContext();

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
    report = await loadMonthlyClinicReport(
      supabase,
      clinicId,
      monthStart,
      monthEnd,
      periodLabel
    );
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
        <div className="flex flex-wrap justify-end gap-2">
          <Link href="/reportes/bi">
            <Button size="sm" variant="outline">
              BI especialidad / cobertura
            </Button>
          </Link>
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
          <AsyncReportButton />
        </Card>
      </div>
    </>
  );
}

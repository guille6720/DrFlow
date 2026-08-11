"use client";

import Link from "next/link";

import { ExportCsvButton } from "@/features/dashboard/components/reportes/export-csv-button";
import {
  type BiPeriod,
  buildBiReportCsv,
  buildBiReportUrl,
  type ClinicBiReport,
  topBiRows,
} from "@/features/reportes/utils/bi-report";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";

type Props = {
  period: BiPeriod;
  periodLabel: string;
  report: ClinicBiReport;
};

const PERIOD_TABS: { id: BiPeriod; label: string }[] = [
  { id: "daily", label: "Hoy" },
  { id: "weekly", label: "Semana" },
  { id: "monthly", label: "Mes" },
];

function DistributionTable({
  title,
  rows,
  nameKey,
}: {
  title: string;
  rows: Array<{ count: number; pct?: number } & Record<string, string | number>>;
  nameKey: string;
}) {
  const top = topBiRows(rows);

  return (
    <Card title={title}>
      {top.length === 0 ? (
        <p className="text-sm text-slate-500">Sin atenciones en el período.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {top.map((row) => (
            <li key={String(row[nameKey])} className="py-2">
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-medium text-slate-900">{String(row[nameKey])}</span>
                <span className="text-slate-600">
                  {row.count}
                  {row.pct != null ? ` (${row.pct}%)` : ""}
                </span>
              </div>
              {row.pct != null ? (
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-teal-500"
                    style={{ width: `${Math.min(100, row.pct)}%` }}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function BiReportView({ period, periodLabel, report }: Props) {
  const csvRows = buildBiReportCsv(report, periodLabel);
  const stats = report.appointment_stats;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {PERIOD_TABS.map((tab) => (
            <Link key={tab.id} href={buildBiReportUrl(tab.id)}>
              <Button type="button" size="sm" variant={period === tab.id ? "primary" : "outline"}>
                {tab.label}
              </Button>
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/reportes">
            <Button type="button" size="sm" variant="outline">
              Reportes operativos
            </Button>
          </Link>
          <ExportCsvButton
            rows={csvRows}
            filename={`bi-${period}-${periodLabel.replace(/\s+/g, "-")}.csv`}
          />
        </div>
      </div>

      <p className="text-sm text-slate-600">Período: {periodLabel}</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Atenciones" value={stats.attended} />
        <StatCard title="Tasa asistencia" value={`${stats.attendance_rate}%`} />
        <StatCard title="Coberturas distintas" value={report.unique_coverages} />
        <StatCard title="Especialidades" value={report.unique_specialties} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DistributionTable title="Por cobertura" rows={report.by_coverage} nameKey="coverage" />
        <DistributionTable title="Por especialidad" rows={report.by_specialty} nameKey="specialty" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DistributionTable title="Por sede" rows={report.by_location} nameKey="location" />
        <Card title="Especialidad × cobertura (top)">
          {report.by_specialty_coverage.length === 0 ? (
            <p className="text-sm text-slate-500">Sin datos cruzados.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {topBiRows(report.by_specialty_coverage, 12).map((row) => (
                <li key={`${row.specialty}-${row.coverage}`} className="flex justify-between py-2">
                  <span>
                    <span className="font-medium">{row.specialty}</span>
                    <span className="text-slate-500"> · {row.coverage}</span>
                  </span>
                  <span className="font-semibold">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Resumen operativo del período">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div>
            <dt className="text-slate-500">Turnos programados</dt>
            <dd className="text-lg font-semibold">{stats.total_scheduled}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Presencial</dt>
            <dd className="text-lg font-semibold">{stats.presencial}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Virtual</dt>
            <dd className="text-lg font-semibold">{stats.virtual}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Ausentismo</dt>
            <dd className="text-lg font-semibold">{stats.no_show}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Cancelaciones</dt>
            <dd className="text-lg font-semibold">{stats.cancelled}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}

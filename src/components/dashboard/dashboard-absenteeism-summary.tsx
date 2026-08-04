import type { DashboardStatsDetail } from "@/lib/utils/dashboard-stats-types";

interface Props {
  detail: DashboardStatsDetail;
}

export function DashboardAbsenteeismSummary({ detail }: Props) {
  const { weekly, monthly } = detail.absenteeism;

  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Semanal</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{weekly.rate}%</p>
        <p className="mt-1 text-xs text-slate-600">
          {weekly.noShowCount} ausencias de {weekly.totalAppointments} turnos
        </p>
        <p className="mt-0.5 text-xs text-slate-500">{weekly.label}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mensual</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{monthly.rate}%</p>
        <p className="mt-1 text-xs text-slate-600">
          {monthly.noShowCount} ausencias de {monthly.totalAppointments} turnos
        </p>
        <p className="mt-0.5 text-xs text-slate-500">{monthly.label}</p>
      </div>
    </div>
  );
}

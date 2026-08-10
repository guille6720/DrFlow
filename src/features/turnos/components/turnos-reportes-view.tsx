import Link from "next/link";

import type { TurnosDashboardMetrics } from "@/features/turnos/utils/turnos-metrics";
import { formatRatePercent } from "@/features/turnos/utils/turnos-metrics";

import { Card } from "@/components/ui/card";

type Props = {
  metrics: TurnosDashboardMetrics;
};

function MetricTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="drflow-card-light rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

export function TurnosReportesView({ metrics }: Props) {
  const { today, last30Days, last7Days, byProfessional } = metrics;

  return (
    <div className="drflow-card-light space-y-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reportes de turnos</h1>
          <p className="text-sm text-slate-600">Indicadores operativos de la agenda médica.</p>
        </div>
        <Link href="/turnos/agenda" className="text-sm font-medium text-teal-700 hover:underline">
          Ir a la agenda →
        </Link>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Hoy</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile label="Total" value={today.total} />
          <MetricTile label="Confirmados" value={today.confirmed} />
          <MetricTile label="Pendientes" value={today.pending} />
          <MetricTile label="Atendidos" value={today.attended} />
          <MetricTile label="Cancelados" value={today.cancelled} />
          <MetricTile label="Ausentes" value={today.noShow} />
          <MetricTile label="Sobreturnos" value={today.overbooking} />
          <MetricTile label="Horarios libres hoy" value={last7Days.freeSlotsToday} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
          Últimos 30 días
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile label="Turnos" value={last30Days.total} />
          <MetricTile label="Cancelaciones" value={formatRatePercent(last30Days.cancellationRate)} />
          <MetricTile label="Ausentismo" value={formatRatePercent(last30Days.noShowRate)} />
          <MetricTile label="Atendidos" value={last30Days.attended} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
          Ocupación (7 días)
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricTile label="Ocupación" value={formatRatePercent(last7Days.occupancyRate)} />
          <MetricTile label="Minutos reservados" value={last7Days.bookedMinutes} />
          <MetricTile label="Capacidad (min)" value={last7Days.capacityMinutes} />
        </div>
      </section>

      <Card title="Turnos por profesional (hoy)" className="drflow-card-light border-slate-200 bg-white">
        {byProfessional.length === 0 ? (
          <p className="text-sm text-slate-600">Sin profesionales activos.</p>
        ) : (
          <ul className="divide-y divide-slate-200 text-sm">
            {byProfessional.map((row) => (
              <li key={row.professionalId} className="flex items-center justify-between py-2">
                <span className="text-slate-800">{row.professionalName}</span>
                <span className="font-semibold text-slate-900">{row.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

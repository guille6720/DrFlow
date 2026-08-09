import Link from "next/link";

import type { TurnosDashboardMetrics } from "@/features/turnos/utils/turnos-metrics";
import { formatRatePercent } from "@/features/turnos/utils/turnos-metrics";

import { Card } from "@/components/ui/card";

type Props = {
  metrics: TurnosDashboardMetrics;
};

function MetricTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

export function TurnosReportesView({ metrics }: Props) {
  const { today, last30Days, last7Days, byProfessional } = metrics;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Reportes de turnos</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Indicadores operativos de la agenda médica.
          </p>
        </div>
        <Link href="/turnos/agenda" className="text-sm font-medium text-[var(--primary)] hover:underline">
          Ir a la agenda →
        </Link>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Hoy
        </h2>
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
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
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
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Ocupación (7 días)
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricTile label="Ocupación" value={formatRatePercent(last7Days.occupancyRate)} />
          <MetricTile
            label="Minutos reservados"
            value={last7Days.bookedMinutes}
          />
          <MetricTile
            label="Capacidad (min)"
            value={last7Days.capacityMinutes}
          />
        </div>
      </section>

      <Card title="Turnos por profesional (hoy)">
        {byProfessional.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">Sin profesionales activos.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)] text-sm">
            {byProfessional.map((row) => (
              <li key={row.professionalId} className="flex items-center justify-between py-2">
                <span>{row.professionalName}</span>
                <span className="font-semibold">{row.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

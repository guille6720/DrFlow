import type { TurnosDashboardMetrics } from "@/features/turnos/utils/turnos-metrics";
import { formatRatePercent } from "@/features/turnos/utils/turnos-metrics";

export function MetricTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="drflow-card-light rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

export function TurnosTodayMetricsSection({
  today,
  freeSlotsToday,
}: {
  today: TurnosDashboardMetrics["today"];
  freeSlotsToday: number;
}) {
  return (
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
        <MetricTile label="Horarios libres hoy" value={freeSlotsToday} />
      </div>
    </section>
  );
}

export function TurnosByProfessionalCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ professionalId: string; professionalName: string; count: number }>;
}) {
  return (
    <div className="drflow-card-light rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">Sin profesionales activos.</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-200 text-sm">
          {rows.map((row) => (
            <li key={row.professionalId} className="flex items-center justify-between py-2">
              <span className="text-slate-800">{row.professionalName}</span>
              <span className="font-semibold text-slate-900">{row.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TurnosPeriodSummarySection({
  title,
  summary,
}: {
  title: string;
  summary: {
    total: number;
    cancellationRate: number;
    noShowRate: number;
    attended: number;
  };
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="Turnos" value={summary.total} />
        <MetricTile label="Cancelaciones" value={formatRatePercent(summary.cancellationRate)} />
        <MetricTile label="Ausentismo" value={formatRatePercent(summary.noShowRate)} />
        <MetricTile label="Atendidos" value={summary.attended} />
      </div>
    </section>
  );
}

export function TurnosOccupancySection({
  title,
  occupancy,
}: {
  title: string;
  occupancy: {
    occupancyRate: number;
    bookedMinutes: number;
    capacityMinutes: number;
  };
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile label="Ocupación" value={formatRatePercent(occupancy.occupancyRate)} />
        <MetricTile label="Minutos reservados" value={occupancy.bookedMinutes} />
        <MetricTile label="Capacidad (min)" value={occupancy.capacityMinutes} />
      </div>
    </section>
  );
}

import Link from "next/link";

import {
  TurnosByProfessionalCard,
  TurnosTodayMetricsSection,
} from "@/features/turnos/components/turnos-metrics-panels";
import type { TurnosDashboardMetrics } from "@/features/turnos/utils/turnos-metrics";

type Props = {
  metrics: TurnosDashboardMetrics;
  canViewReports?: boolean;
};

export function TurnosDashboardTodayView({ metrics, canViewReports = false }: Props) {
  return (
    <div className="drflow-card-light space-y-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Operaciones del día</h2>
          <p className="text-sm text-slate-600">Resumen de turnos para hoy en tu consultorio.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm font-medium">
          <Link href="/turnos/agenda" className="text-teal-700 hover:underline">
            Ir a la agenda →
          </Link>
          {canViewReports ? (
            <Link href="/turnos/reportes" className="text-teal-700 hover:underline">
              Ver reportes →
            </Link>
          ) : null}
        </div>
      </div>

      <TurnosTodayMetricsSection
        today={metrics.today}
        freeSlotsToday={metrics.last7Days.freeSlotsToday}
      />

      <TurnosByProfessionalCard
        title="Turnos por profesional (hoy)"
        rows={metrics.byProfessional}
      />
    </div>
  );
}

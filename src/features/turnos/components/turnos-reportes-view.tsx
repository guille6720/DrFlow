import Link from "next/link";

import {
  TurnosByProfessionalCard,
  TurnosOccupancySection,
  TurnosPeriodSummarySection,
} from "@/features/turnos/components/turnos-metrics-panels";
import { TurnosReportesPeriodTabs } from "@/features/turnos/components/turnos-reportes-period-tabs";
import type { TurnosPeriodReportMetrics } from "@/features/turnos/utils/turnos-metrics";

type Props = {
  metrics: TurnosPeriodReportMetrics;
};

export function TurnosReportesView({ metrics }: Props) {
  const periodDaysLabel =
    metrics.period === "week" ? "7 días" : metrics.period === "month" ? "30 días" : "365 días";

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

      <TurnosReportesPeriodTabs activePeriod={metrics.period} />

      <TurnosPeriodSummarySection
        title={`Resumen (${metrics.periodLabel} · últimos ${periodDaysLabel})`}
        summary={metrics.summary}
      />

      <TurnosOccupancySection
        title={`Ocupación (${metrics.periodLabel})`}
        occupancy={metrics.occupancy}
      />

      <TurnosByProfessionalCard
        title={`Turnos por profesional (${metrics.periodLabel.toLowerCase()})`}
        rows={metrics.byProfessional}
      />
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/shared/utils/cn";

import {
  TURNOS_REPORT_PERIOD_LABELS,
  type TurnosReportPeriod,
} from "@/features/turnos/utils/turnos-metrics";

const PERIODS: TurnosReportPeriod[] = ["week", "month", "year"];

export function TurnosReportesPeriodTabs({ activePeriod }: { activePeriod: TurnosReportPeriod }) {
  const pathname = usePathname();

  return (
    <div
      className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1"
      role="tablist"
      aria-label="Período del reporte"
    >
      {PERIODS.map((period) => {
        const active = period === activePeriod;
        return (
          <Link
            key={period}
            href={`${pathname}?period=${period}`}
            role="tab"
            aria-selected={active}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition",
              active
                ? "bg-white text-teal-800 shadow-sm ring-1 ring-teal-200"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
            )}
          >
            {TURNOS_REPORT_PERIOD_LABELS[period]}
          </Link>
        );
      })}
    </div>
  );
}

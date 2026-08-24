"use client";

import { cn } from "@/shared/utils/cn";

import {
  AGENDA_DAY_FILTER_OPTIONS,
  type AgendaDayFilterBucket,
} from "@/features/turnos/utils/appointment-lifecycle";

type Props = {
  active: AgendaDayFilterBucket;
  counts: Record<AgendaDayFilterBucket, number>;
  onChange: (value: AgendaDayFilterBucket) => void;
};

export function AgendaDayStatusFilters({ active, counts, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Filtrar turnos del día"
      className="flex flex-wrap gap-1 border-b border-slate-200 bg-white px-3 py-2"
    >
      {AGENDA_DAY_FILTER_OPTIONS.map((option) => {
        const count = counts[option.value] ?? 0;
        const selected = active === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
              selected
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            )}
          >
            {option.label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                selected ? "bg-white/25 text-white" : "bg-white text-slate-700"
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

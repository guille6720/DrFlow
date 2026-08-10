"use client";

import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { memo, useMemo } from "react";

import { cn } from "@/shared/utils/cn";

interface AgendaDateStripProps {
  selectedDay: Date;
  onSelectDay: (day: Date) => void;
}

const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;

export const AgendaDateStrip = memo(function AgendaDateStrip({
  selectedDay,
  onSelectDay,
}: AgendaDateStripProps) {
  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(selectedDay, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }, [selectedDay]);

  return (
    <div className="drflow-card-light overflow-hidden rounded-2xl bg-white p-3 shadow-lg shadow-slate-900/5 ring-1 ring-slate-200/80 sm:p-4">
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const selected = isSameDay(day, selectedDay);
          const weekdayIndex = day.getDay();

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDay(day)}
              className={cn(
                "flex w-full flex-col items-center rounded-xl px-2 py-3 text-center transition-all",
                selected
                  ? "bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-md shadow-cyan-500/30"
                  : "bg-slate-50 text-slate-800 ring-1 ring-slate-200 hover:bg-white hover:ring-slate-300"
              )}
            >
              <span
                className={cn(
                  "text-xs font-bold uppercase tracking-wide",
                  selected ? "text-white" : "text-slate-600"
                )}
              >
                {WEEKDAY_LABELS[weekdayIndex]}
              </span>
              <span
                className={cn(
                  "mt-1 text-2xl font-bold tabular-nums leading-none",
                  selected ? "text-white" : "text-slate-900"
                )}
              >
                {format(day, "d")}
              </span>
              <span
                className={cn(
                  "mt-1 text-xs font-semibold capitalize",
                  selected ? "text-white/90" : "text-slate-600"
                )}
              >
                {format(day, "MMM", { locale: es })}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

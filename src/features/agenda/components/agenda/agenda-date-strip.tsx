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
    <div className="flex gap-2 overflow-x-auto pb-1">
      {weekDays.map((day) => {
        const selected = isSameDay(day, selectedDay);
        const weekdayIndex = day.getDay();

        return (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => onSelectDay(day)}
            className={cn(
              "flex min-w-[4.5rem] flex-col items-center rounded-2xl px-3 py-2.5 text-center transition-all",
              selected
                ? "bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-lg shadow-cyan-500/30"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300"
            )}
          >
            <span className={cn("text-[11px] font-semibold uppercase tracking-wide", selected ? "text-white/90" : "text-slate-500")}>
              {WEEKDAY_LABELS[weekdayIndex]}
            </span>
            <span className={cn("mt-0.5 text-xl font-bold tabular-nums", selected ? "text-white" : "text-slate-900")}>
              {format(day, "d")}
            </span>
            <span className={cn("mt-0.5 text-[10px] capitalize", selected ? "text-white/80" : "text-slate-400")}>
              {format(day, "MMM", { locale: es })}
            </span>
          </button>
        );
      })}
    </div>
  );
});

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
    <div className="drflow-card-light overflow-hidden rounded-2xl bg-white p-3 ring-1 ring-slate-200 sm:p-4">
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const selected = isSameDay(day, selectedDay);
          const weekdayIndex = day.getDay();

          return (
            <button
              key={day.toISOString()}
              type="button"
              data-selected={selected ? "true" : "false"}
              onClick={() => onSelectDay(day)}
              className={cn(
                "drflow-agenda-date-btn flex w-full flex-col items-center rounded-xl px-2 py-3 text-center transition-all",
                !selected && "hover:shadow-sm"
              )}
            >
              <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
                {WEEKDAY_LABELS[weekdayIndex]}
              </span>
              <span className="mt-1 text-2xl font-bold tabular-nums leading-none text-slate-900">
                {format(day, "d")}
              </span>
              <span className="mt-1 text-xs font-semibold capitalize text-slate-600">
                {format(day, "MMM", { locale: es })}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

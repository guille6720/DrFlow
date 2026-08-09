"use client";

import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { memo, useMemo } from "react";

import type { AppointmentAgendaRow } from "@/core/supabase/query-types";

import { cn } from "@/shared/utils/cn";

interface MonthOverviewGridProps {
  monthDate: Date;
  appointments: AppointmentAgendaRow[];
  onDayClick?: (day: Date) => void;
}

const WEEK_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

function buildDayCounts(appointments: AppointmentAgendaRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const appt of appointments) {
    const key = format(parseISO(appt.start_at), "yyyy-MM-dd");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

const MonthDayCell = memo(function MonthDayCell({
  day,
  monthDate,
  count,
  onDayClick,
}: {
  day: Date;
  monthDate: Date;
  count: number;
  onDayClick?: (day: Date) => void;
}) {
  const inMonth = isSameMonth(day, monthDate);
  const today = isSameDay(day, new Date());

  function handleClick() {
    onDayClick?.(day);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex min-h-[5.5rem] flex-col border-b border-r border-slate-700/80 p-2 text-left transition-colors",
        inMonth ? "bg-slate-800/90" : "bg-slate-900/50",
        onDayClick && inMonth && "cursor-pointer hover:bg-slate-700/90"
      )}
    >
      <span
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-lg text-sm font-semibold",
          today && "bg-teal-500 text-white",
          !today && inMonth && "text-slate-200",
          !inMonth && "text-slate-600"
        )}
      >
        {format(day, "d")}
      </span>
      {count > 0 ? (
        <span className="mt-auto text-xs font-medium text-teal-300">
          {count} turno{count === 1 ? "" : "s"}
        </span>
      ) : null}
    </button>
  );
});

export function MonthOverviewGrid({
  monthDate,
  appointments,
  onDayClick,
}: MonthOverviewGridProps) {
  const days = useMemo(() => {
    const monthStart = startOfMonth(monthDate);
    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 }),
    });
  }, [monthDate]);

  const dayCounts = useMemo(() => buildDayCounts(appointments), [appointments]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-600/80 bg-slate-800 shadow-xl shadow-black/20">
      <div className="grid grid-cols-7 border-b border-slate-600/80 bg-slate-900/90">
        {WEEK_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-400"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-[minmax(5.5rem,1fr)]">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          return (
            <MonthDayCell
              key={day.toISOString()}
              day={day}
              monthDate={monthDate}
              count={dayCounts.get(key) ?? 0}
              onDayClick={onDayClick}
            />
          );
        })}
      </div>
      <p className="border-t border-slate-700/80 bg-slate-900/80 px-4 py-2 text-xs text-slate-400">
        {format(monthDate, "MMMM yyyy", { locale: es })} — tocá un día para centrar la semana
      </p>
    </div>
  );
}

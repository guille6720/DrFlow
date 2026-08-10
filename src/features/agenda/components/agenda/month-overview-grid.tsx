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
        "flex min-h-[4.5rem] flex-col border-b border-r border-slate-200 p-2 text-left transition-colors",
        inMonth ? "bg-white" : "bg-slate-50/80",
        onDayClick && inMonth && "cursor-pointer hover:bg-cyan-50/60"
      )}
    >
      <span
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-lg text-sm font-semibold",
          today && "bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-sm",
          !today && inMonth && "text-slate-800",
          !inMonth && "text-slate-400"
        )}
      >
        {format(day, "d")}
      </span>
      {count > 0 ? (
        <span className="mt-auto text-xs font-bold text-teal-800">
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
    <div className="drflow-card-light overflow-hidden rounded-2xl bg-white text-slate-900 shadow-lg shadow-slate-900/5 ring-1 ring-slate-200/80">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
        <h2 className="text-base font-bold capitalize text-slate-900">
          {format(monthDate, "MMMM yyyy", { locale: es })}
        </h2>
        <p className="text-sm font-medium text-slate-600">Vista mensual</p>
      </div>
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {WEEK_LABELS.map((label) => (
          <div
            key={label}
            className="px-1 py-2 text-center text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid auto-rows-[minmax(4.5rem,1fr)] grid-cols-7">
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
    </div>
  );
}

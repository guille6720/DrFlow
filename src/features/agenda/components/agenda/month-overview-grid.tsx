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
  const busy = count >= 3;

  function handleClick() {
    onDayClick?.(day);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex min-h-[5.5rem] flex-col border-b border-r border-slate-700/50 p-2 text-left transition-all",
        inMonth ? "bg-slate-800/80" : "bg-slate-950/60",
        onDayClick && inMonth && "cursor-pointer hover:bg-slate-700/80 hover:ring-1 hover:ring-inset hover:ring-teal-500/25",
        today && inMonth && "bg-teal-950/30",
        busy && inMonth && count > 0 && "bg-teal-950/20"
      )}
    >
      <span
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold transition-colors",
          today && "bg-gradient-to-br from-teal-500 to-cyan-500 text-white shadow-md shadow-teal-500/30",
          !today && inMonth && "text-slate-200",
          !inMonth && "text-slate-600"
        )}
      >
        {format(day, "d")}
      </span>
      {count > 0 ? (
        <div className="mt-auto space-y-1">
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
              busy
                ? "bg-teal-500/20 text-teal-200 ring-1 ring-teal-400/30"
                : "bg-slate-700/80 text-teal-300"
            )}
          >
            {count} turno{count === 1 ? "" : "s"}
          </span>
        </div>
      ) : (
        <span className="mt-auto text-[10px] text-slate-600">{inMonth ? "—" : ""}</span>
      )}
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
    <div className="overflow-hidden rounded-2xl border border-slate-600/60 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 shadow-xl shadow-black/30 ring-1 ring-white/5">
      <div className="grid grid-cols-7 border-b border-slate-600/60 bg-slate-950/80">
        {WEEK_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid auto-rows-[minmax(5.5rem,1fr)] grid-cols-7">
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
      <p className="border-t border-slate-700/60 bg-slate-950/70 px-4 py-2.5 text-xs text-slate-400">
        {format(monthDate, "MMMM yyyy", { locale: es })} — tocá un día para verlo en la agenda diaria
      </p>
    </div>
  );
}

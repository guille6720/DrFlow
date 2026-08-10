"use client";

import { endOfWeek, isWithinInterval, parseISO, startOfWeek } from "date-fns";
import { CalendarCheck2, CalendarClock, CalendarDays, UserX } from "lucide-react";
import { memo, useMemo } from "react";

import type { AppointmentAgendaRow } from "@/core/supabase/query-types";

import { cn } from "@/shared/utils/cn";

interface AgendaSummaryCardsProps {
  appointments: AppointmentAgendaRow[];
  anchorDay: Date;
}

type SummaryCard = {
  label: string;
  value: number;
  icon: typeof CalendarDays;
  className: string;
};

export const AgendaSummaryCards = memo(function AgendaSummaryCards({
  appointments,
  anchorDay,
}: AgendaSummaryCardsProps) {
  const cards = useMemo(() => {
    const weekStart = startOfWeek(anchorDay, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(anchorDay, { weekStartsOn: 1 });

    const weekAppointments = appointments.filter((appointment) => {
      const start = parseISO(appointment.start_at);
      return isWithinInterval(start, { start: weekStart, end: weekEnd });
    });

    const confirmed = weekAppointments.filter((a) => a.status === "confirmed").length;
    const pending = weekAppointments.filter((a) => a.status === "pending").length;
    const cancelled = weekAppointments.filter(
      (a) => a.status === "cancelled" || a.status === "no_show"
    ).length;

    const summary: SummaryCard[] = [
      {
        label: "Turnos esta semana",
        value: weekAppointments.length,
        icon: CalendarDays,
        className: "from-cyan-50 to-teal-50 text-cyan-900 ring-cyan-100",
      },
      {
        label: "Confirmados",
        value: confirmed,
        icon: CalendarCheck2,
        className: "from-emerald-50 to-teal-50 text-emerald-900 ring-emerald-100",
      },
      {
        label: "Pendientes",
        value: pending,
        icon: CalendarClock,
        className: "from-amber-50 to-orange-50 text-amber-900 ring-amber-100",
      },
      {
        label: "Cancelados / ausentes",
        value: cancelled,
        icon: UserX,
        className: "from-slate-50 to-slate-100 text-slate-800 ring-slate-200",
      },
    ];

    return summary;
  }, [appointments, anchorDay]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article
            key={card.label}
            className={cn(
              "drflow-card-light rounded-2xl bg-gradient-to-br p-4 ring-1",
              card.className
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-3xl font-bold tabular-nums">{card.value}</p>
                <p className="mt-1 text-sm font-semibold">{card.label}</p>
              </div>
              <span className="rounded-xl bg-white/80 p-2 shadow-sm">
                <Icon className="h-5 w-5" />
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
});

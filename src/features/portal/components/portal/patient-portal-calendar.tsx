import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { formatClinicDateTime } from "@/shared/utils/clinic-timezone";
import { cn } from "@/shared/utils/cn";

import type { PatientRequestItem } from "@/features/portal/utils/patient-portal-appointments";

const WEEKDAYS = [
  ["Lun", "Lunes"], ["Mar", "Martes"], ["Mié", "Miércoles"], ["Jue", "Jueves"],
  ["Vie", "Viernes"], ["Sáb", "Sábado"], ["Dom", "Domingo"],
];

export function PatientPortalCalendar({ items }: { items: PatientRequestItem[] }) {
  const today = formatClinicDateTime(new Date(), "yyyy-MM-dd");
  const [month, setMonth] = useState(() => startOfMonth(parseISO(today)));
  const days = eachDayOfInterval({
    start: startOfWeek(month, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  const weeks = Array.from({ length: days.length / 7 }, (_, index) => days.slice(index * 7, index * 7 + 7));
  const appointmentDays = new Map<string, Set<string>>();
  for (const item of items) {
    if (item.type !== "turno" || !item.startAt || (item.status !== "pending" && item.status !== "confirmed")) continue;
    const key = formatClinicDateTime(item.startAt, "yyyy-MM-dd");
    const statuses = appointmentDays.get(key) ?? new Set();
    statuses.add(item.status);
    appointmentDays.set(key, statuses);
  }
  const showsAppointments = days.some((day) => appointmentDays.has(format(day, "yyyy-MM-dd")));
  const monthLabel = format(month, "MMMM 'de' yyyy", { locale: es });
  const pageButtonClass = "inline-grid h-11 w-11 shrink-0 place-items-center rounded-xl text-emerald-800 hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-600";

  return (
    <section aria-labelledby="patient-calendar-title" className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50 px-2">
        <button type="button" className={pageButtonClass} aria-label="Mes anterior" onClick={() => setMonth((current) => addMonths(current, -1))}>
          <ChevronLeft aria-hidden="true" className="h-5 w-5" />
        </button>
        <h2 id="patient-calendar-title" aria-live="polite" className="font-semibold capitalize text-emerald-950">{monthLabel}</h2>
        <button type="button" className={pageButtonClass} aria-label="Mes siguiente" onClick={() => setMonth((current) => addMonths(current, 1))}>
          <ChevronRight aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 px-2 pb-2 pt-1">
        <table aria-label={`Calendario de ${monthLabel}`} className="h-full w-full table-fixed text-center tabular-nums">
          <thead>
            <tr>
              {WEEKDAYS.map(([short, label]) => (
                <th key={label} scope="col" aria-label={label} className="h-8 text-[11px] font-semibold text-slate-500">{short}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={format(week[0], "yyyy-MM-dd")}>
                {week.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const confirmed = appointmentDays.get(key)?.has("confirmed");
                  const pending = appointmentDays.get(key)?.has("pending");
                  const isToday = key === today;
                  return (
                    <td key={key} className="border-t border-slate-100">
                      <span aria-current={isToday ? "date" : undefined} className={cn(
                        "relative inline-flex h-9 w-9 items-center justify-center rounded-full text-sm",
                        isToday ? "bg-emerald-700 font-semibold text-white" :
                          isSameMonth(day, month) ? "text-slate-800" : "text-slate-500",
                        (confirmed || pending) && "pb-1"
                      )}>
                        <span aria-hidden="true">{day.getDate()}</span>
                        <span className="sr-only">
                          {format(day, "d 'de' MMMM", { locale: es })}
                          {confirmed ? ", turno confirmado" : ""}{pending ? ", turno pendiente" : ""}
                        </span>
                        {(confirmed || pending) && (
                          <span aria-hidden="true" className="absolute bottom-1 flex gap-0.5">
                            {confirmed && <span className={cn("h-1.5 w-1.5 rounded-full", isToday ? "bg-white" : "bg-emerald-600")} />}
                            {pending && <span className={cn("h-1.5 w-1.5 rounded-full", isToday ? "bg-amber-300" : "bg-amber-500")} />}
                          </span>
                        )}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showsAppointments && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-slate-100 px-3 py-2 text-xs text-slate-600">
          <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-600" /> Confirmado</span>
          <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-500" /> Pendiente</span>
        </div>
      )}
    </section>
  );
}

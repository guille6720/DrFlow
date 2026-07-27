"use client";

import { format, parseISO, isSameDay, getHours, getMinutes } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils/cn";
import { isOnlineBooking } from "@/lib/utils/appointment";
import type { Appointment } from "@/types/database";
import { Badge, appointmentStatusBadge } from "@/components/ui/badge";
import { Globe } from "lucide-react";

const HOUR_START = 8;
const HOUR_END = 20;
const SLOT_MINUTES = 30;

function timeSlots() {
  const slots: string[] = [];
  for (let h = HOUR_START; h < HOUR_END; h++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}

interface Block {
  start_at: string;
  end_at: string;
  reason: string | null;
}

interface CalendarGridProps {
  weekDays: Date[];
  appointments: Appointment[];
  blocks?: Block[];
  onSlotClick?: (day: Date, time: string) => void;
}

export function CalendarGrid({
  weekDays,
  appointments,
  blocks = [],
  onSlotClick,
}: CalendarGridProps) {
  const slots = timeSlots();

  function apptsFor(day: Date, time: string) {
    const [h, m] = time.split(":").map(Number);
    return appointments.filter((a) => {
      const d = parseISO(a.start_at);
      return isSameDay(d, day) && getHours(d) === h && getMinutes(d) === m;
    });
  }

  function isBlocked(day: Date, time: string) {
    const [h, m] = time.split(":").map(Number);
    const slotStart = new Date(day);
    slotStart.setHours(h, m, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + SLOT_MINUTES * 60000);
    return blocks.some((b) => {
      const bs = new Date(b.start_at);
      const be = new Date(b.end_at);
      return slotStart < be && slotEnd > bs;
    });
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-600/80 bg-slate-800 shadow-xl shadow-black/20">
      <div className="min-w-[800px]">
        <div
          className="grid border-b border-slate-600/80"
          style={{ gridTemplateColumns: `64px repeat(${weekDays.length}, 1fr)` }}
        >
          <div className="bg-slate-900/90 p-2" />
          {weekDays.map((day) => (
            <div
              key={day.toISOString()}
              className="border-l border-slate-700/80 bg-slate-900/70 p-2 text-center"
            >
              <p className="text-xs font-medium uppercase text-teal-400/90">
                {format(day, "EEE", { locale: es })}
              </p>
              <p className="text-lg font-bold text-slate-100">{format(day, "d")}</p>
            </div>
          ))}
        </div>
        {slots.map((time) => (
          <div
            key={time}
            className="grid border-b border-slate-700/60"
            style={{ gridTemplateColumns: `64px repeat(${weekDays.length}, 1fr)` }}
          >
            <div className="bg-slate-900/80 px-2 py-1 text-right text-[10px] font-medium text-slate-500">
              {time}
            </div>
            {weekDays.map((day) => {
              const dayAppts = apptsFor(day, time);
              const blocked = isBlocked(day, time);
              return (
                <div
                  key={`${day.toISOString()}-${time}`}
                  className={cn(
                    "relative min-h-[28px] border-l border-slate-700/50 bg-slate-800/60 p-0.5 transition-colors",
                    blocked && "bg-red-950/40",
                    !blocked &&
                      dayAppts.length === 0 &&
                      onSlotClick &&
                      "cursor-pointer hover:bg-slate-700/80"
                  )}
                  onClick={() => {
                    if (!blocked && dayAppts.length === 0 && onSlotClick) {
                      onSlotClick(day, time);
                    }
                  }}
                >
                  {blocked && dayAppts.length === 0 && (
                    <span className="block truncate px-1 text-[9px] text-red-400/90">Bloqueo</span>
                  )}
                  {dayAppts.map((appt) => {
                    const status = appointmentStatusBadge[appt.status];
                    const online = isOnlineBooking(appt);
                    return (
                      <div
                        key={appt.id}
                        className="mb-0.5 truncate rounded-md bg-gradient-to-r from-teal-600 to-cyan-600 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm"
                        title={`${appt.patients ? `${(appt.patients as { last_name: string; first_name: string }).last_name}` : "Paciente"}${online ? " (reserva web)" : ""}`}
                      >
                        {online && <Globe className="mr-0.5 inline h-2.5 w-2.5" />}
                        {(appt.patients as { first_name?: string; last_name?: string })?.last_name ??
                          "Turno"}
                        {status && (
                          <Badge variant={status.variant} className="ml-1 scale-75">
                            {status.label}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

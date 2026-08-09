"use client";

import { format, getHours, getMinutes, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Globe } from "lucide-react";
import Link from "next/link";
import { memo, useMemo } from "react";

import type { AppointmentAgendaRow } from "@/core/supabase/query-types";

import { cn } from "@/shared/utils/cn";

import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

import { appointmentStatusBadge, Badge } from "@/components/ui/badge";
import { isOnlineBooking } from "@/lib/utils/appointment";

const HOUR_START = 8;
const HOUR_END = 20;
const SLOT_MINUTES = 30;

const TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let h = HOUR_START; h < HOUR_END; h++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
})();

interface Block {
  start_at: string;
  end_at: string;
  reason: string | null;
}

interface CalendarGridProps {
  weekDays: Date[];
  appointments: AppointmentAgendaRow[];
  blocks?: Block[];
  onSlotClick?: (day: Date, time: string) => void;
  canOpenClinical?: boolean;
}

function slotKey(day: Date, time: string): string {
  return `${format(day, "yyyy-MM-dd")}-${time}`;
}

function appointmentSlotKey(startAt: string): string {
  const d = parseISO(startAt);
  const minutes = getMinutes(d);
  const time = `${String(getHours(d)).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return `${format(d, "yyyy-MM-dd")}-${time}`;
}

function isSlotBlocked(day: Date, time: string, blocks: Block[]): boolean {
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

function buildAppointmentAgendaRowsBySlot(appointments: AppointmentAgendaRow[]): Map<string, AppointmentAgendaRow[]> {
  const map = new Map<string, AppointmentAgendaRow[]>();
  for (const appt of appointments) {
    const key = appointmentSlotKey(appt.start_at);
    const list = map.get(key);
    if (list) {
      list.push(appt);
    } else {
      map.set(key, [appt]);
    }
  }
  return map;
}

function buildBlockedSlotKeys(weekDays: Date[], blocks: Block[]): Set<string> {
  const set = new Set<string>();
  if (blocks.length === 0) return set;
  for (const day of weekDays) {
    for (const time of TIME_SLOTS) {
      if (isSlotBlocked(day, time, blocks)) {
        set.add(slotKey(day, time));
      }
    }
  }
  return set;
}

function buildClinicalHref(appt: AppointmentAgendaRow): string {
  return buildPatientWorkspaceUrl(appt.patient_id, {
    tab: "soap",
    action: "nueva",
    appointment: appt.id,
    professional: appt.professional_id,
  });
}

const CalendarAppointmentAgendaRowChip = memo(function CalendarAppointmentAgendaRowChip({
  appt,
  canOpenClinical,
}: {
  appt: AppointmentAgendaRow;
  canOpenClinical?: boolean;
}) {
  const status = appointmentStatusBadge[appt.status];
  const online = isOnlineBooking(appt);
  const patient = appt.patients as { first_name?: string; last_name?: string } | undefined;
  const label = `${patient?.last_name ?? "Paciente"}${online ? " (reserva web)" : ""}`;
  const className =
    "mb-0.5 block truncate rounded-md bg-gradient-to-r from-teal-600 to-cyan-600 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm transition-opacity hover:opacity-90";

  const content = (
    <>
      {online && <Globe className="mr-0.5 inline h-2.5 w-2.5" />}
      {patient?.last_name ?? "Turno"}
      {status ? (
        <Badge variant={status.variant} className="ml-1 scale-75">
          {status.label}
        </Badge>
      ) : null}
    </>
  );

  if (canOpenClinical && appt.status !== "cancelled") {
    return (
      <Link
        href={buildClinicalHref(appt)}
        className={className}
        title={`${label} — abrir historia clínica`}
        onClick={(event) => event.stopPropagation()}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={className} title={label}>
      {content}
    </div>
  );
});

const CalendarSlotCell = memo(function CalendarSlotCell({
  day,
  time,
  dayAppts,
  blocked,
  onSlotClick,
  canOpenClinical,
}: {
  day: Date;
  time: string;
  dayAppts: AppointmentAgendaRow[];
  blocked: boolean;
  onSlotClick?: (day: Date, time: string) => void;
  canOpenClinical?: boolean;
}) {
  function handleClick() {
    if (!blocked && dayAppts.length === 0 && onSlotClick) {
      onSlotClick(day, time);
    }
  }

  return (
    <div
      className={cn(
        "relative min-h-[28px] border-l border-slate-700/50 bg-slate-800/60 p-0.5 transition-colors",
        blocked && "bg-red-950/40",
        !blocked && dayAppts.length === 0 && onSlotClick && "cursor-pointer hover:bg-teal-950/30 hover:ring-1 hover:ring-teal-500/40"
      )}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleClick();
        }
      }}
      role={!blocked && dayAppts.length === 0 && onSlotClick ? "button" : undefined}
      tabIndex={!blocked && dayAppts.length === 0 && onSlotClick ? 0 : undefined}
      title={
        !blocked && dayAppts.length === 0 && onSlotClick
          ? `Dar turno el ${format(day, "d/M")} a las ${time}`
          : undefined
      }
      aria-label={
        !blocked && dayAppts.length === 0 && onSlotClick
          ? `Dar turno el ${format(day, "d/M")} a las ${time}`
          : undefined
      }
    >
      {blocked && dayAppts.length === 0 ? (
        <span className="block truncate px-1 text-[9px] text-red-400/90">Bloqueo</span>
      ) : null}
      {dayAppts.map((appt) => (
        <CalendarAppointmentAgendaRowChip
          key={appt.id}
          appt={appt}
          canOpenClinical={canOpenClinical}
        />
      ))}
    </div>
  );
});

export function CalendarGrid({
  weekDays,
  appointments,
  blocks = [],
  onSlotClick,
  canOpenClinical = false,
}: CalendarGridProps) {
  const gridColumnStyle = useMemo(
    () => ({ gridTemplateColumns: `64px repeat(${weekDays.length}, 1fr)` }),
    [weekDays.length]
  );

  const appointmentsBySlot = useMemo(
    () => buildAppointmentAgendaRowsBySlot(appointments),
    [appointments]
  );

  const blockedSlotKeys = useMemo(
    () => buildBlockedSlotKeys(weekDays, blocks),
    [weekDays, blocks]
  );

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-600/80 bg-slate-800 shadow-xl shadow-black/20">
      <div className="min-w-[640px]">
        <div className="grid border-b border-slate-600/80" style={gridColumnStyle}>
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
        {TIME_SLOTS.map((time) => (
          <div key={time} className="grid border-b border-slate-700/60" style={gridColumnStyle}>
            <div className="bg-slate-900/80 px-2 py-1 text-right text-[10px] font-medium text-slate-500">
              {time}
            </div>
            {weekDays.map((day) => {
              const key = slotKey(day, time);
              return (
                <CalendarSlotCell
                  key={key}
                  day={day}
                  time={time}
                  dayAppts={appointmentsBySlot.get(key) ?? []}
                  blocked={blockedSlotKeys.has(key)}
                  onSlotClick={onSlotClick}
                  canOpenClinical={canOpenClinical}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { format, getHours, getMinutes, isSameDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Globe } from "lucide-react";
import Link from "next/link";
import { memo, useMemo } from "react";

import type { AppointmentAgendaRow } from "@/core/supabase/query-types";

import { cn } from "@/shared/utils/cn";
import {
  formatPatientDocument,
  formatPatientName,
  resolveAppointmentPatient,
} from "@/shared/utils/patient-display";

import { buildAppointmentConsultationUrl } from "@/features/pacientes/utils/patient-workspace-actions";

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

const STATUS_CARD_STYLES: Record<string, string> = {
  pending:
    "border-l-amber-400 bg-gradient-to-r from-amber-950/90 via-amber-900/70 to-slate-800/80 text-amber-50",
  confirmed:
    "border-l-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_28%,#0f172a)] text-[var(--text-on-sidebar,#f8fafc)]",
  attended:
    "border-l-emerald-400 bg-gradient-to-r from-emerald-950/90 via-emerald-900/60 to-slate-800/80 text-emerald-50",
  cancelled:
    "border-l-slate-500 bg-slate-800/90 text-slate-400 line-through opacity-75",
  no_show:
    "border-l-red-400 bg-gradient-to-r from-red-950/90 via-red-900/60 to-slate-800/80 text-red-100",
};

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
  onAppointmentClick?: (appointment: AppointmentAgendaRow) => void;
  canOpenClinical?: boolean;
  canManage?: boolean;
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
  return buildAppointmentConsultationUrl(appt.patient_id, {
    appointmentId: appt.id,
    professionalId: appt.professional_id,
  });
}

function appointmentCardTitle(appt: AppointmentAgendaRow): string {
  const name = formatPatientName(appt.patients);
  const dni = formatPatientDocument(resolveAppointmentPatient(appt.patients)?.document_number);
  const time = format(parseISO(appt.start_at), "HH:mm");
  return dni ? `${name} · DNI ${dni} · ${time} hs` : `${name} · ${time} hs`;
}

const CalendarAppointmentCard = memo(function CalendarAppointmentCard({
  appt,
  canOpenClinical,
  canManage,
  onAppointmentClick,
}: {
  appt: AppointmentAgendaRow;
  canOpenClinical?: boolean;
  canManage?: boolean;
  onAppointmentClick?: (appointment: AppointmentAgendaRow) => void;
}) {
  const status = appointmentStatusBadge[appt.status];
  const online = isOnlineBooking(appt);
  const patient = resolveAppointmentPatient(appt.patients);
  const fullName = formatPatientName(appt.patients);
  const dni = formatPatientDocument(patient?.document_number);
  const isCancelled = appt.status === "cancelled";
  const timeLabel = format(parseISO(appt.start_at), "HH:mm");
  const cardTitle = appointmentCardTitle(appt);

  const className = cn(
    "group mb-1 w-full rounded-lg border-l-[3px] px-2 py-1.5 text-left shadow-sm ring-1 ring-white/5 transition hover:brightness-110 hover:shadow-md",
    STATUS_CARD_STYLES[appt.status] ?? STATUS_CARD_STYLES.confirmed
  );

  const content = (
    <>
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold leading-snug">
            {online ? <Globe className="mr-0.5 inline h-3 w-3 shrink-0 opacity-90" /> : null}
            {fullName}
          </p>
          {dni ? (
            <p className="mt-0.5 truncate text-[10px] font-medium opacity-85">DNI {dni}</p>
          ) : (
            <p className="mt-0.5 truncate text-[10px] italic opacity-60">Sin DNI</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="rounded-md bg-black/20 px-1.5 py-0.5 text-[9px] font-semibold tabular-nums">
            {timeLabel}
          </span>
          {status ? (
            <Badge variant={status.variant} className="scale-[0.72] origin-top-right px-1.5">
              {status.label}
            </Badge>
          ) : null}
        </div>
      </div>
    </>
  );

  if (canManage && onAppointmentClick) {
    return (
      <button
        type="button"
        className={className}
        title={cardTitle}
        onClick={(event) => {
          event.stopPropagation();
          onAppointmentClick(appt);
        }}
      >
        {content}
      </button>
    );
  }

  if (canOpenClinical && !isCancelled) {
    return (
      <Link
        href={buildClinicalHref(appt)}
        className={className}
        title={`${cardTitle} — abrir historia clínica`}
        onClick={(event) => event.stopPropagation()}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={className} title={cardTitle}>
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
  onAppointmentClick,
  canOpenClinical,
  canManage,
  isHourStart,
}: {
  day: Date;
  time: string;
  dayAppts: AppointmentAgendaRow[];
  blocked: boolean;
  onSlotClick?: (day: Date, time: string) => void;
  onAppointmentClick?: (appointment: AppointmentAgendaRow) => void;
  canOpenClinical?: boolean;
  canManage?: boolean;
  isHourStart?: boolean;
}) {
  function handleClick() {
    if (!blocked && dayAppts.length === 0 && onSlotClick) {
      onSlotClick(day, time);
    }
  }

  return (
    <div
      className={cn(
        "relative min-h-[3.25rem] border-l border-slate-700/40 p-1 transition-colors",
        isHourStart ? "bg-slate-800/70" : "bg-slate-800/40",
        blocked && "bg-red-950/30",
        !blocked &&
          dayAppts.length === 0 &&
          onSlotClick &&
          "cursor-pointer hover:bg-teal-950/25 hover:ring-1 hover:ring-inset hover:ring-teal-500/30"
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
        <span className="block truncate px-1 text-[9px] font-medium uppercase tracking-wide text-red-400/90">
          Bloqueo
        </span>
      ) : null}
      {dayAppts.map((appt) => (
        <CalendarAppointmentCard
          key={appt.id}
          appt={appt}
          canOpenClinical={canOpenClinical}
          canManage={canManage}
          onAppointmentClick={onAppointmentClick}
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
  onAppointmentClick,
  canOpenClinical = false,
  canManage = false,
}: CalendarGridProps) {
  const gridColumnStyle = useMemo(
    () => ({ gridTemplateColumns: `72px repeat(${weekDays.length}, 1fr)` }),
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

  const today = useMemo(() => new Date(), []);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-600/60 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 shadow-xl shadow-black/30 ring-1 ring-white/5">
      <div className="min-w-[640px]">
        <div className="grid border-b border-slate-600/60" style={gridColumnStyle}>
          <div className="bg-slate-950/80 p-2" />
          {weekDays.map((day) => {
            const isToday = isSameDay(day, today);
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "border-l border-slate-700/50 p-3 text-center",
                  isToday
                    ? "bg-gradient-to-b from-[color-mix(in_srgb,var(--primary)_25%,transparent)] to-slate-900/80"
                    : "bg-slate-900/80"
                )}
              >
                <p
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-wider",
                    isToday ? "text-[var(--sidebar-accent,var(--primary))]" : "text-slate-400"
                  )}
                >
                  {format(day, "EEE", { locale: es })}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-2xl font-bold tabular-nums",
                    isToday ? "text-teal-100" : "text-slate-100"
                  )}
                >
                  {format(day, "d")}
                </p>
                <p className="mt-0.5 text-[10px] capitalize text-slate-500">
                  {format(day, "MMM yyyy", { locale: es })}
                </p>
              </div>
            );
          })}
        </div>
        {TIME_SLOTS.map((time) => {
          const isHourStart = time.endsWith(":00");
          return (
            <div
              key={time}
              className={cn(
                "grid border-b border-slate-700/40",
                isHourStart && "border-slate-600/50"
              )}
              style={gridColumnStyle}
            >
              <div
                className={cn(
                  "flex items-start justify-end px-2 py-1.5 text-right",
                  isHourStart ? "bg-slate-950/70" : "bg-slate-950/50"
                )}
              >
                <span
                  className={cn(
                    "text-[10px] font-medium tabular-nums",
                    isHourStart ? "text-slate-300" : "text-slate-600"
                  )}
                >
                  {time}
                </span>
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
                    onAppointmentClick={onAppointmentClick}
                    canOpenClinical={canOpenClinical}
                    canManage={canManage}
                    isHourStart={isHourStart}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

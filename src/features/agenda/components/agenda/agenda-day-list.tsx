"use client";

import { format, isSameDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Globe, Plus } from "lucide-react";
import Link from "next/link";
import { memo, useMemo, useState } from "react";

import type { AppointmentAgendaRow } from "@/core/supabase/query-types";

import { cn } from "@/shared/utils/cn";
import {
  formatPatientDocument,
  formatPatientName,
  resolveAppointmentPatient,
} from "@/shared/utils/patient-display";

import { AgendaDayStatusFilters } from "@/features/agenda/components/agenda/agenda-day-status-filters";
import { AppointmentAttendanceSelector } from "@/features/agenda/components/agenda/appointment-attendance-selector";
import { filterAppointmentsForDay } from "@/features/agenda/components/agenda/appointment-row";
import { WaitingRoomWaitTimer } from "@/features/agenda/components/agenda/waiting-room-wait-timer";
import { AppointmentLifecycleBadge } from "@/features/turnos/components/appointment-lifecycle-badge";
import {
  AGENDA_DAY_FILTER_OPTIONS,
  AGENDA_DAY_ROW_TINT,
  type AgendaDayFilterBucket,
  resolveAgendaDayFilterBucket,
  type WaitingRoomStatus,
} from "@/features/turnos/utils/appointment-lifecycle";

import { isOnlineBooking } from "@/lib/utils/appointment";
import { getProfessionalDisplayName } from "@/lib/utils/professional";

interface AgendaDayListProps {
  day: Date;
  appointments: AppointmentAgendaRow[];
  canManage?: boolean;
  canStartClinical?: boolean;
  onAppointmentClick?: (appointment: AppointmentAgendaRow) => void;
  onEmptySlotClick?: () => void;
}

function professionalLabel(appointment: AppointmentAgendaRow): string | null {
  const nested = appointment.professionals;
  const professional = Array.isArray(nested) ? nested[0] : nested;
  if (!professional) return null;
  return getProfessionalDisplayName(professional);
}

function emptyCounts(): Record<AgendaDayFilterBucket, number> {
  return {
    all: 0,
    reserved: 0,
    waiting: 0,
    in_consultation: 0,
    attended: 0,
    absent: 0,
    cancelled: 0,
  };
}

const AgendaDayListItem = memo(function AgendaDayListItem({
  appointment,
  day,
  canManage,
  canStartClinical,
  onAppointmentClick,
}: {
  appointment: AppointmentAgendaRow;
  day: Date;
  canManage?: boolean;
  canStartClinical?: boolean;
  onAppointmentClick?: (appointment: AppointmentAgendaRow) => void;
}) {
  const [localEnteredAt, setLocalEnteredAt] = useState<string | null>(null);
  const [localWaiting, setLocalWaiting] = useState<WaitingRoomStatus | null>(null);
  const patient = resolveAppointmentPatient(appointment.patients);
  const fullName = formatPatientName(appointment.patients);
  const dni = formatPatientDocument(patient?.document_number);
  const phone = patient?.phone?.trim() || null;
  const insurance = patient?.insurance_provider?.trim() || null;
  const online = isOnlineBooking(appointment);
  const professionalName = professionalLabel(appointment);
  const specialtyName =
    (appointment.specialties as { name?: string } | undefined)?.name ?? null;
  const locationName =
    (appointment.locations as { name?: string } | undefined)?.name ?? null;
  const timeLabel = format(parseISO(appointment.start_at), "HH:mm");
  const isCancelled = appointment.status === "cancelled";
  const waitingStatus = localWaiting ?? appointment.waiting_room_status;
  const enteredAt = localEnteredAt ?? appointment.waiting_room_entered_at ?? null;
  const bucket = resolveAgendaDayFilterBucket({
    status: appointment.status,
    waitingRoomStatus: waitingStatus,
    waitingRoomEnteredAt: enteredAt,
  });
  const modality =
    appointment.consultation_modality === "virtual" ? "Virtual" : "Consulta";
  const canAttend =
    Boolean(canStartClinical) &&
    Boolean(enteredAt) &&
    (waitingStatus === "waiting" ||
      waitingStatus === "confirmed" ||
      waitingStatus === "in_consultation");
  const attendHref = `/consultas?appointment=${appointment.id}&action=nueva&professional=${appointment.professional_id}`;

  const attendance = canManage ? (
    <AppointmentAttendanceSelector
      appointmentId={appointment.id}
      status={appointment.status}
      waitingRoomStatus={appointment.waiting_room_status}
      waitingRoomEnteredAt={enteredAt}
      openConsultaOnPresent={false}
      onAttendanceSaved={(value) => {
        const previous = localWaiting ?? appointment.waiting_room_status;
        const wasInQueue =
          Boolean(enteredAt) && (previous === "waiting" || previous === "confirmed");
        setLocalWaiting(value);
        if (value === "waiting" || value === "confirmed") {
          if (!wasInQueue) {
            setLocalEnteredAt(new Date().toISOString());
          }
        }
      }}
    />
  ) : null;

  const rowClassName = cn(
    "flex w-full items-center gap-3 border-b border-slate-200/80 px-3 py-2 text-left transition-colors last:border-b-0 hover:brightness-[0.98]",
    AGENDA_DAY_ROW_TINT[bucket]
  );

  const content = (
    <>
      <div className="flex w-16 shrink-0 flex-col items-start gap-0.5 sm:w-20">
        <p className="text-sm font-bold tabular-nums text-slate-900">{timeLabel}</p>
        <WaitingRoomWaitTimer
          waitingRoomStatus={waitingStatus}
          enteredAt={enteredAt}
          enableLiveTimer={isSameDay(day, new Date())}
        />
        <AppointmentLifecycleBadge
          status={appointment.status}
          waitingRoomStatus={waitingStatus}
          waitingRoomEnteredAt={enteredAt}
          isOverbooking={appointment.is_overbooking ?? false}
          rescheduledAt={appointment.rescheduled_at}
        />
      </div>

      <div className="min-w-0 flex-[1.2]">
        <p className={cn("truncate text-sm font-bold text-slate-900", isCancelled && "line-through opacity-70")}>
          {online ? <Globe className="mr-1 inline h-3.5 w-3.5 text-sky-600" /> : null}
          {fullName}
        </p>
        {phone ? (
          <p className="truncate text-xs font-medium text-slate-700">{phone}</p>
        ) : null}
        <p className="truncate text-xs text-slate-600">{dni ? `DNI ${dni}` : "Sin DNI"}</p>
      </div>

      <div className="hidden min-w-0 flex-1 sm:block">
        <p className="truncate text-sm font-semibold text-slate-900">{insurance ?? "Particular"}</p>
        {patient?.insurance_plan ? (
          <p className="truncate text-xs text-slate-600">{patient.insurance_plan}</p>
        ) : null}
      </div>

      <div className="hidden min-w-0 flex-[1.2] md:block">
        <p className="truncate text-sm font-semibold text-slate-900">
          {modality}
          {specialtyName ? ` · ${specialtyName}` : ""}
        </p>
        <p className="truncate text-xs text-slate-700">
          {[professionalName, locationName].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>
    </>
  );

  const sideActions = (
    <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
      {canAttend ? (
        <Link
          href={attendHref}
          onClick={(event) => event.stopPropagation()}
          className="inline-flex"
        >
          <span className="rounded-md bg-teal-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-800">
            Atender
          </span>
        </Link>
      ) : null}
      {attendance}
    </div>
  );

  if (canManage && onAppointmentClick) {
    return (
      <div className={rowClassName}>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={() => onAppointmentClick(appointment)}
        >
          {content}
        </button>
        {sideActions}
      </div>
    );
  }

  return (
    <div className={rowClassName}>
      {content}
      {sideActions}
    </div>
  );
});

export const AgendaDayList = memo(function AgendaDayList({
  day,
  appointments,
  canManage,
  canStartClinical,
  onAppointmentClick,
  onEmptySlotClick,
}: AgendaDayListProps) {
  const [filter, setFilter] = useState<AgendaDayFilterBucket>("all");
  const dayAppointments = filterAppointmentsForDay(appointments, day);

  const counts = useMemo(() => {
    const next = emptyCounts();
    next.all = dayAppointments.length;
    for (const appointment of dayAppointments) {
      const bucket = resolveAgendaDayFilterBucket({
        status: appointment.status,
        waitingRoomStatus: appointment.waiting_room_status,
        waitingRoomEnteredAt: appointment.waiting_room_entered_at,
      });
      next[bucket] += 1;
    }
    return next;
  }, [dayAppointments]);

  const visible = useMemo(() => {
    if (filter === "all") return dayAppointments;
    return dayAppointments.filter(
      (appointment) =>
        resolveAgendaDayFilterBucket({
          status: appointment.status,
          waitingRoomStatus: appointment.waiting_room_status,
          waitingRoomEnteredAt: appointment.waiting_room_entered_at,
        }) === filter
    );
  }, [dayAppointments, filter]);

  return (
    <section className="drflow-card-light overflow-hidden rounded-2xl bg-white text-slate-900 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
        <div>
          <h2 className="text-base font-bold capitalize text-slate-900">
            {format(day, "EEEE, d 'de' MMMM", { locale: es })}
          </h2>
          <p className="mt-0.5 text-xs font-medium text-slate-600">
            {dayAppointments.length === 0
              ? "Sin turnos programados"
              : `${dayAppointments.length} turno${dayAppointments.length === 1 ? "" : "s"}`}
          </p>
        </div>
        {canManage && onEmptySlotClick ? (
          <button
            type="button"
            onClick={onEmptySlotClick}
            className="inline-flex items-center gap-2 rounded-xl drflow-accent-fill px-3 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Agregar turno
          </button>
        ) : null}
      </div>

      {dayAppointments.length > 0 ? (
        <AgendaDayStatusFilters active={filter} counts={counts} onChange={setFilter} />
      ) : null}

      {dayAppointments.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm text-slate-500">No hay turnos para este día.</p>
          {canManage ? (
            <Link
              href="/turnos/nuevo"
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-800"
            >
              <Plus className="h-4 w-4" />
              Crear nuevo turno
            </Link>
          ) : null}
        </div>
      ) : visible.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-slate-500">
          No hay turnos en “
          {AGENDA_DAY_FILTER_OPTIONS.find((option) => option.value === filter)?.label ?? filter}”.
        </div>
      ) : (
        <div>
          {visible.map((appointment) => (
            <AgendaDayListItem
              key={appointment.id}
              appointment={appointment}
              day={day}
              canManage={canManage}
              canStartClinical={canStartClinical}
              onAppointmentClick={onAppointmentClick}
            />
          ))}
        </div>
      )}
    </section>
  );
});

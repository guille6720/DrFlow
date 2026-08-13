"use client";

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Clock3, Globe, Plus } from "lucide-react";
import Link from "next/link";
import { memo, useState } from "react";

import type { AppointmentAgendaRow } from "@/core/supabase/query-types";

import { cn } from "@/shared/utils/cn";
import {
  formatPatientDocument,
  formatPatientName,
  resolveAppointmentPatient,
} from "@/shared/utils/patient-display";

import { AppointmentAttendanceSelector } from "@/features/agenda/components/agenda/appointment-attendance-selector";
import { filterAppointmentsForDay } from "@/features/agenda/components/agenda/appointment-row";
import { WaitingRoomWaitTimer } from "@/features/agenda/components/agenda/waiting-room-wait-timer";
import { AppointmentLifecycleBadge } from "@/features/turnos/components/appointment-lifecycle-badge";
import type { WaitingRoomStatus } from "@/features/turnos/utils/appointment-lifecycle";

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

const AgendaDayListItem = memo(function AgendaDayListItem({
  appointment,
  canManage,
  onAppointmentClick,
}: {
  appointment: AppointmentAgendaRow;
  canManage?: boolean;
  onAppointmentClick?: (appointment: AppointmentAgendaRow) => void;
}) {
  const [localEnteredAt, setLocalEnteredAt] = useState<string | null>(null);
  const [localWaiting, setLocalWaiting] = useState<WaitingRoomStatus | null>(null);
  const patient = resolveAppointmentPatient(appointment.patients);
  const fullName = formatPatientName(appointment.patients);
  const dni = formatPatientDocument(patient?.document_number);
  const online = isOnlineBooking(appointment);
  const professionalName = professionalLabel(appointment);
  const timeLabel = format(parseISO(appointment.start_at), "HH:mm");
  const isCancelled = appointment.status === "cancelled";
  const waitingStatus = localWaiting ?? appointment.waiting_room_status;
  const enteredAt = localEnteredAt ?? appointment.waiting_room_entered_at ?? null;

  const metaParts = [
    dni ? `DNI ${dni}` : "Sin DNI",
    professionalName,
    (appointment.specialties as { name?: string } | undefined)?.name ?? null,
  ].filter(Boolean);

  const content = (
    <>
      <WaitingRoomWaitTimer
        waitingRoomStatus={waitingStatus}
        enteredAt={enteredAt}
      />
      <div className="flex w-24 shrink-0 items-center gap-2 sm:w-28">
        <Clock3 className="h-4 w-4 shrink-0 text-cyan-600" />
        <p className="text-base font-bold tabular-nums text-slate-900">{timeLabel} hs</p>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className={cn("text-base font-bold text-slate-900", isCancelled && "line-through opacity-70")}>
            {online ? <Globe className="mr-1 inline h-4 w-4 text-sky-600" /> : null}
            {fullName}
          </p>
          <AppointmentLifecycleBadge
            status={appointment.status}
            waitingRoomStatus={waitingStatus}
            waitingRoomEnteredAt={enteredAt}
            isOverbooking={appointment.is_overbooking ?? false}
            rescheduledAt={appointment.rescheduled_at}
          />
        </div>
        <p className="mt-2 text-base font-medium text-slate-800">{metaParts.join(" · ")}</p>
        {appointment.notes ? (
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{appointment.notes}</p>
        ) : null}
      </div>
    </>
  );

  const attendance = canManage ? (
    <AppointmentAttendanceSelector
      appointmentId={appointment.id}
      status={appointment.status}
      waitingRoomStatus={appointment.waiting_room_status}
      waitingRoomEnteredAt={enteredAt}
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

  const rowClassName =
    "flex w-full items-center gap-5 border-b border-slate-200 px-5 py-4 text-left transition-colors last:border-b-0 hover:bg-slate-50/80";

  if (canManage && onAppointmentClick) {
    return (
      <div className={rowClassName}>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-5 text-left"
          onClick={() => onAppointmentClick(appointment)}
        >
          {content}
        </button>
        {attendance}
      </div>
    );
  }

  return (
    <div className={rowClassName}>
      {content}
      {attendance}
    </div>
  );
});

export const AgendaDayList = memo(function AgendaDayList({
  day,
  appointments,
  canManage,
  canStartClinical: _canStartClinical,
  onAppointmentClick,
  onEmptySlotClick,
}: AgendaDayListProps) {
  const dayAppointments = filterAppointmentsForDay(appointments, day);

  return (
    <section className="drflow-card-light overflow-hidden rounded-2xl bg-white text-slate-900 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
        <div>
          <h2 className="text-lg font-bold capitalize text-slate-900">
            {format(day, "EEEE, d 'de' MMMM", { locale: es })}
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-600">
            {dayAppointments.length === 0
              ? "Sin turnos programados"
              : `${dayAppointments.length} turno${dayAppointments.length === 1 ? "" : "s"} programado${dayAppointments.length === 1 ? "" : "s"}`}
          </p>
        </div>
        {canManage && onEmptySlotClick ? (
          <button
            type="button"
            onClick={onEmptySlotClick}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-600 px-3 py-2 text-sm font-semibold text-white shadow-md shadow-cyan-500/20 hover:from-cyan-600 hover:to-teal-700"
          >
            <Plus className="h-4 w-4" />
            Agregar turno
          </button>
        ) : null}
      </div>

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
      ) : (
        <div>
          {dayAppointments.map((appointment) => (
            <AgendaDayListItem
              key={appointment.id}
              appointment={appointment}
              canManage={canManage}
              onAppointmentClick={onAppointmentClick}
            />
          ))}
        </div>
      )}
    </section>
  );
});

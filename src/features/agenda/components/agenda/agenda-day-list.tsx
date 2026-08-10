"use client";

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Clock3, Globe, Plus } from "lucide-react";
import Link from "next/link";
import { memo } from "react";

import type { AppointmentAgendaRow } from "@/core/supabase/query-types";

import { cn } from "@/shared/utils/cn";
import {
  formatPatientDocument,
  formatPatientName,
  resolveAppointmentPatient,
} from "@/shared/utils/patient-display";

import { filterAppointmentsForDay } from "@/features/agenda/components/agenda/appointment-row";
import { AppointmentLifecycleBadge } from "@/features/turnos/components/appointment-lifecycle-badge";

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
  const patient = resolveAppointmentPatient(appointment.patients);
  const fullName = formatPatientName(appointment.patients);
  const dni = formatPatientDocument(patient?.document_number);
  const online = isOnlineBooking(appointment);
  const professionalName = professionalLabel(appointment);
  const timeLabel = format(parseISO(appointment.start_at), "HH:mm");
  const isCancelled = appointment.status === "cancelled";

  const metaParts = [
    dni ? `DNI ${dni}` : "Sin DNI",
    professionalName,
    (appointment.specialties as { name?: string } | undefined)?.name ?? null,
  ].filter(Boolean);

  const content = (
    <>
      <div className="flex w-24 shrink-0 items-start gap-2 sm:w-28">
        <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
        <div>
          <p className="text-sm font-bold tabular-nums text-slate-900">{timeLabel}</p>
          <p className="text-[11px] text-slate-500">hs</p>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn("font-semibold text-slate-900", isCancelled && "line-through opacity-70")}>
            {online ? <Globe className="mr-1 inline h-3.5 w-3.5 text-sky-600" /> : null}
            {fullName}
          </p>
          <AppointmentLifecycleBadge
            status={appointment.status}
            waitingRoomStatus={appointment.waiting_room_status}
            isOverbooking={appointment.is_overbooking ?? false}
            rescheduledAt={appointment.rescheduled_at}
          />
        </div>
        <p className="mt-1 text-sm text-slate-600">{metaParts.join(" · ")}</p>
        {appointment.notes ? (
          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{appointment.notes}</p>
        ) : null}
      </div>
    </>
  );

  const rowClassName =
    "flex w-full gap-4 border-b border-slate-100 px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-slate-50/80";

  if (canManage && onAppointmentClick) {
    return (
      <button type="button" className={rowClassName} onClick={() => onAppointmentClick(appointment)}>
        {content}
      </button>
    );
  }

  return <div className={rowClassName}>{content}</div>;
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
    <section className="drflow-card-light overflow-hidden rounded-2xl bg-white text-slate-900 shadow-lg shadow-slate-900/5 ring-1 ring-slate-200/80">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold capitalize text-slate-900">
            {format(day, "EEEE, d 'de' MMMM", { locale: es })}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
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

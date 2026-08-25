"use client";

import { useState, useTransition } from "react";

import { toast } from "@/core/notifications/toast";

import { cn } from "@/shared/utils/cn";

import {
  AGENDA_ATTENDANCE_OPTIONS,
  type AgendaAttendanceValue,
  canSetAgendaAttendance,
  resolveAgendaAttendanceValue,
  type WaitingRoomStatus,
} from "@/features/turnos/utils/appointment-lifecycle";

import { updateWaitingRoomRequest } from "@/features/agenda/utils/update-waiting-room-request";
import type { AppointmentStatus } from "@/types/database";

const SELECTED_CLASS: Record<AgendaAttendanceValue, string> = {
  confirmed: "bg-violet-100 text-violet-900",
  absent: "bg-red-100 text-red-800",
  waiting: "bg-amber-100 text-amber-900",
};

type Props = {
  appointmentId: string;
  status: AppointmentStatus;
  waitingRoomStatus?: WaitingRoomStatus | null;
  waitingRoomEnteredAt?: string | null;
  /** Reservado: no redirigir automáticamente a Consultas al marcar Presente (evita crash RSC en prod). */
  openConsultaOnPresent?: boolean;
  onAttendanceSaved?: (value: AgendaAttendanceValue) => void;
};

export function AppointmentAttendanceSelector({
  appointmentId,
  status,
  waitingRoomStatus,
  waitingRoomEnteredAt,
  openConsultaOnPresent: _openConsultaOnPresent = false,
  onAttendanceSaved,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [override, setOverride] = useState<AgendaAttendanceValue | null>(null);
  const serverSelected = resolveAgendaAttendanceValue({
    status,
    waitingRoomStatus,
    waitingRoomEnteredAt,
  });
  const selected = override && override !== serverSelected ? override : serverSelected;

  if (!canSetAgendaAttendance({ status, waitingRoomStatus })) {
    return null;
  }

  function handleSelect(value: AgendaAttendanceValue) {
    const enteringQueue = value === "waiting" || value === "confirmed";
    if (pending) return;
    if (value === selected && (waitingRoomEnteredAt || !enteringQueue)) return;
    setOverride(value);
    startTransition(async () => {
      const result = await updateWaitingRoomRequest(appointmentId, value);
      if ("error" in result) {
        setOverride(null);
        toast.error(result.error);
        return;
      }
      onAttendanceSaved?.(value);
      toast.success(
        value === "confirmed"
          ? "Paciente marcado presente"
          : value === "absent"
            ? "Paciente marcado ausente"
            : "Paciente en espera"
      );
    });
  }

  return (
    <div
      role="group"
      aria-label="Asistencia del paciente"
      className="flex shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-0.5"
    >
      {AGENDA_ATTENDANCE_OPTIONS.map((option) => {
        const isSelected = selected === option.value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={pending}
            aria-pressed={isSelected}
            onClick={(event) => {
              event.stopPropagation();
              handleSelect(option.value);
            }}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60",
              isSelected ? SELECTED_CLASS[option.value] : "text-slate-600 hover:bg-white"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

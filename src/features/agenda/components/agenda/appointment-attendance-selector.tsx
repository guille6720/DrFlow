"use client";

import { useRouter } from "next/navigation";
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

import { updateWaitingRoomStatus } from "@/lib/actions/waiting-room";
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
};

export function AppointmentAttendanceSelector({
  appointmentId,
  status,
  waitingRoomStatus,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [override, setOverride] = useState<AgendaAttendanceValue | null>(null);
  const serverSelected = resolveAgendaAttendanceValue({ status, waitingRoomStatus });
  const selected = override && override !== serverSelected ? override : serverSelected;

  if (!canSetAgendaAttendance({ status, waitingRoomStatus })) {
    return null;
  }

  function handleSelect(value: AgendaAttendanceValue) {
    if (pending || value === selected) return;
    setOverride(value);
    startTransition(async () => {
      const result = await updateWaitingRoomStatus(appointmentId, value);
      if (result.error) {
        setOverride(null);
        toast.error(result.error);
        return;
      }
      router.refresh();
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

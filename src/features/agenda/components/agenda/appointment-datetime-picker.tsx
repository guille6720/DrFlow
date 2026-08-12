"use client";

import { addMonths, format, isAfter, isBefore, isSameDay, isSameMonth, startOfDay, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";

import { cn } from "@/shared/utils/cn";

import { useAppointmentDatetimePicker } from "@/features/agenda/hooks/use-appointment-datetime-picker";

import {
  getAppointmentHorizonEnd,
  isDateWithinAppointmentHorizon,
  isMonthWithinAppointmentHorizon,
} from "@/lib/utils/appointment-booking-horizon";
import { APPOINTMENT_TIME_SLOTS } from "@/lib/utils/appointment-datetime";

interface OccupiedSlot {
  start_at: string;
  end_at: string;
  professional_id?: string;
}

interface BlockSlot {
  start_at: string;
  end_at: string;
}

interface AppointmentDatetimePickerProps {
  value: string;
  onChange: (value: string) => void;
  appointments?: OccupiedSlot[];
  scheduleBlocks?: BlockSlot[];
  professionalId?: string;
  label?: string;
  required?: boolean;
}

const weekDayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function AppointmentDatetimePicker({
  value,
  onChange,
  appointments = [],
  scheduleBlocks = [],
  professionalId,
  label = "Fecha y hora",
  required,
}: AppointmentDatetimePickerProps) {
  const {
    month,
    setMonth,
    calendarDays,
    selectedDate,
    selectedTime,
    selectDate,
    selectTime,
    isSlotOccupied,
    isSlotPast,
  } = useAppointmentDatetimePicker({
    value,
    onChange,
    appointments,
    scheduleBlocks,
    professionalId,
  });
  const canPrevMonth = isMonthWithinAppointmentHorizon(subMonths(month, 1));
  const canNextMonth = isMonthWithinAppointmentHorizon(addMonths(month, 1));
  const horizonEnd = getAppointmentHorizonEnd();

  return (
    <div className="space-y-1 sm:col-span-2">
      <label className="block text-sm font-medium text-slate-300">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>

      <input type="hidden" name="start_at" value={value} required={required} />

      <div className="rounded-xl border border-slate-600/80 bg-slate-800/95 p-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonth(subMonths(month, 1))}
            disabled={!canPrevMonth}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-semibold capitalize text-slate-100">
            {format(month, "MMMM yyyy", { locale: es })}
          </p>
          <button
            type="button"
            onClick={() => setMonth(addMonths(month, 1))}
            disabled={!canNextMonth}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500">
          {weekDayLabels.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day) => {
            const inMonth = isSameMonth(day, month);
            const isPast = isBefore(day, startOfDay(new Date()));
            const isAfterHorizon = isAfter(startOfDay(day), startOfDay(horizonEnd));
            const disabled = isPast || isAfterHorizon || !isDateWithinAppointmentHorizon(day);
            const isSelected = isSameDay(day, selectedDate);
            return (
              <button
                key={day.toISOString()}
                type="button"
                disabled={disabled}
                onClick={() => selectDate(day)}
                className={cn(
                  "aspect-square rounded-lg text-sm font-medium transition-colors",
                  !inMonth && "text-slate-600",
                  inMonth && !disabled && "text-slate-200 hover:bg-slate-700",
                  disabled && "cursor-not-allowed text-slate-600",
                  isSelected && "bg-teal-500 text-slate-900 hover:bg-teal-400"
                )}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>

        <div className="mt-4 border-t border-slate-700/80 pt-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
            <Clock className="h-4 w-4 text-teal-400" />
            Horario — {format(selectedDate, "EEEE d MMM", { locale: es })}
          </div>
          <div className="grid max-h-40 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
            {APPOINTMENT_TIME_SLOTS.map((time) => {
              const occupied = isSlotOccupied(selectedDate, time);
              const past = isSlotPast(selectedDate, time);
              const disabled = occupied || past;
              const active = selectedTime === time;
              return (
                <button
                  key={time}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectTime(time)}
                  className={cn(
                    "rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                    active && "border-teal-500 bg-teal-500 text-slate-900",
                    !active &&
                      !disabled &&
                      "border-slate-600 bg-slate-900/80 text-slate-200 hover:border-teal-500/50 hover:bg-slate-700",
                    disabled && "cursor-not-allowed border-slate-800 bg-slate-900/40 text-slate-600"
                  )}
                  title={occupied ? "Ocupado" : past ? "Horario pasado" : undefined}
                >
                  {time}
                </button>
              );
            })}
          </div>
        </div>

        {value && (
          <p className="mt-3 text-sm text-teal-300">
            Seleccionado:{" "}
            <strong>{format(new Date(value), "EEEE d MMM · HH:mm", { locale: es })}</strong>
          </p>
        )}
      </div>
    </div>
  );
}

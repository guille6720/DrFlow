"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const HOUR_START = 8;
const HOUR_END = 20;
const SLOT_MINUTES = 30;

function buildTimeSlots() {
  const slots: string[] = [];
  for (let h = HOUR_START; h < HOUR_END; h++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}

const TIME_SLOTS = buildTimeSlots();

function toLocalDatetimeValue(date: Date, time: string) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function parseLocalDatetimeValue(value: string): { date: Date; time: string } | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return { date: startOfDay(d), time };
}

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

export function AppointmentDatetimePicker({
  value,
  onChange,
  appointments = [],
  scheduleBlocks = [],
  professionalId,
  label = "Fecha y hora",
  required,
}: AppointmentDatetimePickerProps) {
  const parsed = parseLocalDatetimeValue(value);
  const [pickerDate, setPickerDate] = useState<Date | null>(null);
  const selectedDate = pickerDate ?? parsed?.date ?? startOfDay(new Date());
  const selectedTime = parsed?.time ?? null;
  const [month, setMonth] = useState(() => startOfMonth(selectedDate));

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  function selectDate(day: Date) {
    if (isBefore(day, startOfDay(new Date()))) return;
    setPickerDate(day);
    setMonth(startOfMonth(day));
    if (selectedTime) {
      onChange(toLocalDatetimeValue(day, selectedTime));
    }
  }

  function selectTime(time: string) {
    onChange(toLocalDatetimeValue(selectedDate, time));
  }

  function isSlotOccupied(day: Date, time: string) {
    const [h, m] = time.split(":").map(Number);
    const slotStart = new Date(day);
    slotStart.setHours(h, m, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + SLOT_MINUTES * 60000);

    const apptBusy = appointments.some((a) => {
      if (professionalId && a.professional_id && a.professional_id !== professionalId) {
        return false;
      }
      const start = parseISO(a.start_at);
      const end = parseISO(a.end_at);
      return slotStart < end && slotEnd > start;
    });

    const blockBusy = scheduleBlocks.some((b) => {
      const start = parseISO(b.start_at);
      const end = parseISO(b.end_at);
      return slotStart < end && slotEnd > start;
    });

    return apptBusy || blockBusy;
  }

  function isSlotPast(day: Date, time: string) {
    const [h, m] = time.split(":").map(Number);
    const slot = new Date(day);
    slot.setHours(h, m, 0, 0);
    return slot < new Date();
  }

  const weekDayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <div className="space-y-1 sm:col-span-2">
      <label className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>

      <input type="hidden" name="start_at" value={value} required={required} />

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonth(subMonths(month, 1))}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-semibold capitalize text-slate-800">
            {format(month, "MMMM yyyy", { locale: es })}
          </p>
          <button
            type="button"
            onClick={() => setMonth(addMonths(month, 1))}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-400">
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
            const isSelected = isSameDay(day, selectedDate);
            return (
              <button
                key={day.toISOString()}
                type="button"
                disabled={isPast}
                onClick={() => selectDate(day)}
                className={cn(
                  "aspect-square rounded-lg text-sm font-medium transition-colors",
                  !inMonth && "text-slate-300",
                  inMonth && !isPast && "text-slate-700 hover:bg-blue-50",
                  isPast && "cursor-not-allowed text-slate-300",
                  isSelected && "bg-blue-600 text-white hover:bg-blue-700"
                )}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
            <Clock className="h-4 w-4 text-blue-600" />
            Horario — {format(selectedDate, "EEEE d MMM", { locale: es })}
          </div>
          <div className="grid max-h-40 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
            {TIME_SLOTS.map((time) => {
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
                    active && "border-blue-600 bg-blue-600 text-white",
                    !active && !disabled && "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50",
                    disabled && "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
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
          <p className="mt-3 text-sm text-blue-800">
            Seleccionado:{" "}
            <strong>
              {format(new Date(value), "EEEE d MMM · HH:mm", { locale: es })}
            </strong>
          </p>
        )}
      </div>
    </div>
  );
}

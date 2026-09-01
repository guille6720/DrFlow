"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { FloatingAnchorPanel } from "@/core/components/ui/floating-anchor-panel";

import { cn } from "@/shared/utils/cn";

import { parseLocalDatetimeValue, toLocalDatetimeValue } from "@/lib/utils/appointment-datetime";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

const weekDayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function formatConsultationDateLabel(value: string): string {
  const parsed = parseLocalDatetimeValue(value);
  if (!parsed) return "";
  return format(parsed.date, "dd/MM/yyyy");
}

function buildHourOptions() {
  return Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
}

function buildMinuteOptions() {
  return Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0"));
}

export function ConsultationDatetimePicker({ value, onChange }: Props) {
  const triggerId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const parsed = parseLocalDatetimeValue(value);
  const selectedDate = parsed?.date ?? startOfDay(new Date());
  const selectedTime = parsed?.time ?? format(new Date(), "HH:mm");
  const [month, setMonth] = useState(() => startOfMonth(selectedDate));
  const today = startOfDay(new Date());

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function openPicker() {
    const next = parseLocalDatetimeValue(value)?.date ?? startOfDay(new Date());
    setMonth(startOfMonth(next));
    setOpen(true);
  }

  function togglePicker() {
    if (open) {
      setOpen(false);
      return;
    }
    openPicker();
  }

  function selectDate(day: Date) {
    if (isAfter(startOfDay(day), today)) return;
    onChange(toLocalDatetimeValue(day, selectedTime));
    setMonth(startOfMonth(day));
  }

  function selectTime(nextTime: string) {
    onChange(toLocalDatetimeValue(selectedDate, nextTime));
  }

  const canGoNextMonth = !isAfter(startOfMonth(addMonths(month, 1)), today);

  return (
    <div ref={containerRef} className="flex shrink-0 flex-col gap-1 pt-1">
      <div className="inline-flex flex-wrap items-center gap-2 text-[13px] text-[var(--foreground,#0f172a)]">
        <button
          ref={anchorRef}
          id={triggerId}
          type="button"
          onClick={togglePicker}
          className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-left hover:bg-[var(--muted,#f8fafc)]"
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <CalendarDays className="h-4 w-4 text-[var(--primary,#0F4C5C)]" aria-hidden />
          <span className="font-medium text-[var(--primary,#0F4C5C)]">
            {formatConsultationDateLabel(value)}
          </span>
        </button>
        <button
          type="button"
          onClick={openPicker}
          className="text-[12px] text-slate-500 underline-offset-2 hover:underline"
        >
          Cambiar
        </button>
      </div>

      <p className="text-[11px] text-slate-500">
        Podés cargar evoluciones de fechas anteriores.
      </p>

      <FloatingAnchorPanel
        anchorRef={anchorRef}
        open={open}
        preferredMaxHeight={420}
        className="rounded-lg border border-[var(--border,#e2e8f0)] bg-[var(--card,#fff)] p-3 shadow-xl"
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-labelledby={triggerId}
          onMouseDown={(event) => event.preventDefault()}
          className="min-w-[280px] max-w-[320px]"
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setMonth(subMonths(month, 1))}
              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold capitalize text-[var(--foreground,#0f172a)]">
              {format(month, "MMMM yyyy", { locale: es })}
            </p>
            <button
              type="button"
              onClick={() => setMonth(addMonths(month, 1))}
              disabled={!canGoNextMonth}
              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-500">
            {weekDayLabels.map((label) => (
              <div key={label} className="py-1">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const inMonth = isSameMonth(day, month);
              const isFuture = isAfter(startOfDay(day), today);
              const isSelected = isSameDay(day, selectedDate);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={isFuture}
                  onClick={() => selectDate(day)}
                  className={cn(
                    "aspect-square rounded-md text-sm font-medium transition-colors",
                    !inMonth && "text-slate-300",
                    inMonth && !isFuture && "text-slate-700 hover:bg-slate-100",
                    isFuture && "cursor-not-allowed text-slate-300",
                    isSelected && "bg-[var(--primary,#0F4C5C)] text-white hover:bg-[var(--primary,#0F4C5C)]"
                  )}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-2 border-t border-[var(--border,#e2e8f0)] pt-3">
            <label className="text-xs font-medium text-slate-600" htmlFor={`${triggerId}-hour`}>
              Hora
            </label>
            <select
              id={`${triggerId}-hour`}
              value={selectedTime.split(":")[0] ?? "00"}
              onChange={(event) => {
                const minute = selectedTime.split(":")[1] ?? "00";
                selectTime(`${event.target.value}:${minute}`);
              }}
              className="rounded-md border border-[var(--border,#e2e8f0)] bg-white px-2 py-1 text-sm"
            >
              {buildHourOptions().map((hour) => (
                <option key={hour} value={hour}>
                  {hour}
                </option>
              ))}
            </select>
            <span className="text-slate-500">:</span>
            <select
              id={`${triggerId}-minute`}
              aria-label="Minutos"
              value={selectedTime.split(":")[1] ?? "00"}
              onChange={(event) => {
                const hour = selectedTime.split(":")[0] ?? "00";
                selectTime(`${hour}:${event.target.value}`);
              }}
              className="rounded-md border border-[var(--border,#e2e8f0)] bg-white px-2 py-1 text-sm"
            >
              {buildMinuteOptions().map((minute) => (
                <option key={minute} value={minute}>
                  {minute}
                </option>
              ))}
            </select>
          </div>
        </div>
      </FloatingAnchorPanel>
    </div>
  );
}

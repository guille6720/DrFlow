"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isBefore,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  APPOINTMENT_SLOT_MINUTES,
  parseLocalDatetimeValue,
  toLocalDatetimeValue,
} from "@/lib/utils/appointment-datetime";

interface OccupiedSlot {
  start_at: string;
  end_at: string;
  professional_id?: string;
}

interface BlockSlot {
  start_at: string;
  end_at: string;
}

type Options = {
  value: string;
  onChange: (value: string) => void;
  appointments?: OccupiedSlot[];
  scheduleBlocks?: BlockSlot[];
  professionalId?: string;
};

export function useAppointmentDatetimePicker({
  value,
  onChange,
  appointments = [],
  scheduleBlocks = [],
  professionalId,
}: Options) {
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
    const slotEnd = new Date(slotStart.getTime() + APPOINTMENT_SLOT_MINUTES * 60000);

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

  return {
    month,
    setMonth,
    calendarDays,
    selectedDate,
    selectedTime,
    selectDate,
    selectTime,
    isSlotOccupied,
    isSlotPast,
  };
}

"use client";

import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfWeek,
  isAfter,
  isBefore,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { filterAgendaAppointments } from "@/core/booking/location-filters";
import type { AppointmentAgendaRow } from "@/core/supabase/query-types";

import {
  getAppointmentHorizonEnd,
  getAppointmentHorizonMonthStart,
  isMonthWithinAppointmentHorizon,
} from "@/lib/utils/appointment-booking-horizon";

export type AgendaCalendarMode = "day" | "week" | "month";

type Options = {
  appointments: AppointmentAgendaRow[];
  defaultProfessionalId?: string;
};

function parseViewParam(raw: string | null): AgendaCalendarMode {
  if (raw === "week" || raw === "month" || raw === "day") return raw;
  return "day";
}

export function useAgendaView({
  appointments,
  defaultProfessionalId: _defaultProfessionalId = "",
}: Options) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterProfessional, setFilterProfessional] = useState("");
  const [filterSpecialty, setFilterSpecialty] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [editingAppointment, setEditingAppointment] = useState<AppointmentAgendaRow | null>(null);
  const viewMode = parseViewParam(searchParams.get("view"));

  const setViewMode = useCallback(
    (mode: AgendaCalendarMode) => {
      const params = new URLSearchParams(searchParams.toString());
      if (mode === "day") params.delete("view");
      else params.set("view", mode);
      const qs = params.toString();
      router.replace(qs ? `/turnos/agenda?${qs}` : "/turnos/agenda", { scroll: false });
    },
    [router, searchParams]
  );

  const filtered = useMemo(
    () =>
      filterAgendaAppointments(appointments, {
        professionalId: filterProfessional || undefined,
        specialtyId: filterSpecialty || undefined,
        locationId: filterLocation || undefined,
      }),
    [appointments, filterProfessional, filterSpecialty, filterLocation]
  );

  const weekDays = useMemo(() => {
    const day = startOfDay(currentDate);
    if (viewMode === "week") {
      return eachDayOfInterval({
        start: startOfWeek(day, { weekStartsOn: 1 }),
        end: endOfWeek(day, { weekStartsOn: 1 }),
      });
    }
    return [day];
  }, [currentDate, viewMode]);

  const openNewAppointmentForm = useCallback(() => {
    router.push("/turnos/nuevo");
  }, [router]);

  const handleCreate = useCallback(async () => undefined, []);

  const horizonEnd = useMemo(() => getAppointmentHorizonEnd(), []);
  const horizonMonthStart = useMemo(() => getAppointmentHorizonMonthStart(), []);
  const canPrevMonth = isMonthWithinAppointmentHorizon(addMonths(currentDate, -1));
  const canNextMonth = isMonthWithinAppointmentHorizon(addMonths(currentDate, 1));

  const shiftCalendar = useCallback(
    (back: boolean) => {
      const step = viewMode === "week" ? 7 : 1;
      const next = back ? subDays(currentDate, step) : addDays(currentDate, step);
      if (!back && isAfter(startOfDay(next), startOfDay(horizonEnd))) return;
      setCurrentDate(next);
    },
    [currentDate, horizonEnd, viewMode]
  );

  const goToMonth = useCallback(
    (target: Date) => {
      if (!isMonthWithinAppointmentHorizon(target)) return;
      const today = startOfDay(new Date());
      if (isSameMonth(target, today)) {
        setCurrentDate(today);
        return;
      }
      const monthStart = startOfMonth(target);
      setCurrentDate(isBefore(monthStart, horizonMonthStart) ? horizonMonthStart : monthStart);
    },
    [horizonMonthStart]
  );

  const shiftMonth = useCallback(
    (back: boolean) => {
      goToMonth(addMonths(currentDate, back ? -1 : 1));
    },
    [currentDate, goToMonth]
  );

  const handleSlotClick = useCallback(
    (day: Date, time: string) => {
      const [h, m] = time.split(":").map(Number);
      const d = new Date(day);
      d.setHours(h, m, 0, 0);
      const params = new URLSearchParams({
        start_at: d.toISOString(),
      });
      if (filterProfessional) params.set("professional", filterProfessional);
      if (filterLocation) params.set("location", filterLocation);
      router.push(`/turnos/nuevo?${params.toString()}`);
    },
    [filterProfessional, filterLocation, router]
  );

  return useMemo(
    () => ({
      currentDate,
      setCurrentDate,
      viewMode,
      setViewMode,
      filterProfessional,
      setFilterProfessional,
      filterSpecialty,
      setFilterSpecialty,
      filterLocation,
      setFilterLocation,
      editingAppointment,
      setEditingAppointment,
      filtered,
      weekDays,
      openNewAppointmentForm,
      shiftCalendar,
      shiftMonth,
      goToMonth,
      canPrevMonth,
      canNextMonth,
      handleSlotClick,
      handleCreate,
    }),
    [
      currentDate,
      viewMode,
      setViewMode,
      filterProfessional,
      filterSpecialty,
      filterLocation,
      editingAppointment,
      filtered,
      weekDays,
      openNewAppointmentForm,
      shiftCalendar,
      shiftMonth,
      goToMonth,
      canPrevMonth,
      canNextMonth,
      handleSlotClick,
      handleCreate,
    ]
  );
}

export type AgendaViewState = ReturnType<typeof useAgendaView>;

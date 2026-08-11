"use client";

import {
  addDays,
  startOfDay,
  subDays,
} from "date-fns";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { filterAgendaAppointments } from "@/core/booking/location-filters";
import type { AppointmentAgendaRow } from "@/core/supabase/query-types";

type Options = {
  appointments: AppointmentAgendaRow[];
  defaultProfessionalId?: string;
};

export function useAgendaView({
  appointments,
  defaultProfessionalId: _defaultProfessionalId = "",
}: Options) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterProfessional, setFilterProfessional] = useState("");
  const [filterSpecialty, setFilterSpecialty] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [editingAppointment, setEditingAppointment] = useState<AppointmentAgendaRow | null>(null);

  const filtered = useMemo(
    () =>
      filterAgendaAppointments(appointments, {
        professionalId: filterProfessional || undefined,
        specialtyId: filterSpecialty || undefined,
        locationId: filterLocation || undefined,
      }),
    [appointments, filterProfessional, filterSpecialty, filterLocation]
  );

  const weekDays = useMemo(() => [startOfDay(currentDate)], [currentDate]);

  const openNewAppointmentForm = useCallback(() => {
    router.push("/turnos/nuevo");
  }, [router]);

  const handleCreate = useCallback(async () => undefined, []);

  const shiftCalendar = useCallback(
    (back: boolean) => {
      setCurrentDate(back ? subDays(currentDate, 1) : addDays(currentDate, 1));
    },
    [currentDate]
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
      handleSlotClick,
      handleCreate,
    }),
    [
      currentDate,
      filterProfessional,
      filterSpecialty,
      filterLocation,
      editingAppointment,
      filtered,
      weekDays,
      openNewAppointmentForm,
      shiftCalendar,
      handleSlotClick,
      handleCreate,
    ]
  );
}

export type AgendaViewState = ReturnType<typeof useAgendaView>;

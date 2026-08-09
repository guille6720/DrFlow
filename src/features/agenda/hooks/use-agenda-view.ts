"use client";

import {
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

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
  const [editingAppointment, setEditingAppointment] = useState<AppointmentAgendaRow | null>(null);

  const filtered = useMemo(
    () =>
      appointments.filter((a) => {
        if (filterProfessional && a.professional_id !== filterProfessional) return false;
        if (filterSpecialty && a.specialty_id !== filterSpecialty) return false;
        return true;
      }),
    [appointments, filterProfessional, filterSpecialty]
  );

  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [currentDate]);

  const openNewAppointmentForm = useCallback(() => {
    router.push("/turnos/nuevo");
  }, [router]);

  const handleCreate = useCallback(async () => undefined, []);

  const shiftCalendar = useCallback(
    (back: boolean) => {
      setCurrentDate(back ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
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
      router.push(`/turnos/nuevo?${params.toString()}`);
    },
    [filterProfessional, router]
  );

  return useMemo(
    () => ({
      currentDate,
      setCurrentDate,
      filterProfessional,
      setFilterProfessional,
      filterSpecialty,
      setFilterSpecialty,
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

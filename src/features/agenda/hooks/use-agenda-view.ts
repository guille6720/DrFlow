"use client";

import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import type { AppointmentAgendaRow } from "@/core/supabase/query-types";

import { createAppointment } from "@/lib/actions/appointments";

type ViewMode = "day" | "week" | "month";

type Options = {
  initialView?: ViewMode;
  initialShowForm?: boolean;
  appointments: AppointmentAgendaRow[];
  defaultDuration: number;
  defaultProfessionalId?: string;
};

export function useAgendaView({
  initialView = "week",
  initialShowForm = false,
  appointments,
  defaultDuration,
  defaultProfessionalId = "",
}: Options) {
  const router = useRouter();
  const [view, setView] = useState<ViewMode>(initialView);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showForm, setShowForm] = useState(initialShowForm);
  const [filterProfessional, setFilterProfessional] = useState("");
  const [filterSpecialty, setFilterSpecialty] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [startAt, setStartAt] = useState("");
  const [formProfessionalId, setFormProfessionalId] = useState(defaultProfessionalId);
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

  const openNewAppointmentForm = useCallback((prefill = "") => {
    setStartAt(prefill);
    setShowForm(true);
  }, []);

  const closeForm = useCallback(() => {
    setShowForm(false);
    setStartAt("");
    setFormProfessionalId(defaultProfessionalId);
  }, [defaultProfessionalId]);

  const shiftCalendar = useCallback(
    (back: boolean) => {
      if (view === "day") {
        setCurrentDate(back ? subDays(currentDate, 1) : addDays(currentDate, 1));
      } else if (view === "month") {
        setCurrentDate(back ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
      } else {
        setCurrentDate(back ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
      }
    },
    [view, currentDate]
  );

  const handleSlotClick = useCallback(
    (day: Date, time: string) => {
      const [h, m] = time.split(":").map(Number);
      const d = new Date(day);
      d.setHours(h, m, 0, 0);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      openNewAppointmentForm(local);
    },
    [openNewAppointmentForm]
  );

  const handleCreate = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      const formData = new FormData(e.currentTarget);
      const startAtValue = formData.get("start_at") as string;
      const duration = parseInt(formData.get("duration") as string, 10) || defaultDuration;
      const start = new Date(startAtValue);
      const end = new Date(start.getTime() + duration * 60000);
      formData.set("end_at", end.toISOString());
      formData.set("status", "pending");

      const result = await createAppointment(formData);
      setLoading(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      closeForm();
      router.refresh();
    },
    [closeForm, defaultDuration, router]
  );

  return useMemo(
    () => ({
      view,
      setView,
      currentDate,
      setCurrentDate,
      showForm,
      filterProfessional,
      setFilterProfessional,
      filterSpecialty,
      setFilterSpecialty,
      error,
      loading,
      startAt,
      setStartAt,
      formProfessionalId,
      setFormProfessionalId,
      editingAppointment,
      setEditingAppointment,
      filtered,
      weekDays,
      openNewAppointmentForm,
      closeForm,
      shiftCalendar,
      handleSlotClick,
      handleCreate,
    }),
    [
      view,
      currentDate,
      showForm,
      filterProfessional,
      filterSpecialty,
      error,
      loading,
      startAt,
      formProfessionalId,
      editingAppointment,
      filtered,
      weekDays,
      openNewAppointmentForm,
      closeForm,
      shiftCalendar,
      handleSlotClick,
      handleCreate,
    ]
  );
}

export type AgendaViewState = ReturnType<typeof useAgendaView>;

"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";

import type { ProfessionalAgendaRow } from "@/core/supabase/query-types";

import type { AgendaViewState } from "@/features/agenda/hooks/use-agenda-view";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { getProfessionalDisplayName } from "@/lib/utils/professional";

type Props = {
  agenda: Pick<
    AgendaViewState,
    | "currentDate"
    | "weekDays"
    | "filterProfessional"
    | "setFilterProfessional"
    | "filterSpecialty"
    | "setFilterSpecialty"
    | "shiftCalendar"
    | "setCurrentDate"
  >;
  professionals: ProfessionalAgendaRow[];
  specialties: { id: string; name: string }[];
};

export function AgendaToolbar({ agenda, professionals, specialties }: Props) {
  const {
    currentDate,
    weekDays,
    filterProfessional,
    setFilterProfessional,
    filterSpecialty,
    setFilterSpecialty,
    shiftCalendar,
    setCurrentDate,
  } = agenda;

  const visibleDay = weekDays[0];

  return (
    <div className="drflow-card-light rounded-2xl bg-white p-4 text-slate-900 shadow-lg shadow-slate-900/5 ring-1 ring-slate-200/80">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 p-3 text-white shadow-md shadow-cyan-500/25">
            <CalendarDays className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Agenda y calendario</h1>
            <p className="mt-1 text-base font-medium capitalize text-slate-700">
              {format(visibleDay, "EEEE d 'de' MMMM yyyy", { locale: es })}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            onClick={() => shiftCalendar(true)}
            aria-label="Día anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            onClick={() => setCurrentDate(new Date())}
          >
            Hoy
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            onClick={() => shiftCalendar(false)}
            aria-label="Día siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
        <Select
          options={[
            { value: "", label: "Todos los médicos" },
            ...professionals.map((p) => ({
              value: p.id,
              label: getProfessionalDisplayName(p),
            })),
          ]}
          value={filterProfessional}
          onChange={(e) => setFilterProfessional(e.target.value)}
          className="w-full sm:w-52"
        />

        <Select
          options={[
            { value: "", label: "Todas las especialidades" },
            ...specialties.map((s) => ({ value: s.id, label: s.name })),
          ]}
          value={filterSpecialty}
          onChange={(e) => setFilterSpecialty(e.target.value)}
          className="w-full sm:w-52"
        />

        <span className="hidden text-sm font-medium capitalize text-slate-600 sm:inline">
          {format(currentDate, "MMMM yyyy", { locale: es })}
        </span>

        <Link
          href="/turnos/nuevo"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-cyan-500/20 hover:from-cyan-600 hover:to-teal-700 sm:ml-auto sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Nuevo turno
        </Link>
      </div>
    </div>
  );
}

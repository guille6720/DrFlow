"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";

import type { ProfessionalAgendaRow } from "@/core/supabase/query-types";

import type { AgendaViewState } from "@/features/agenda/hooks/use-agenda-view";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { getProfessionalDisplayName } from "@/lib/utils/professional";

type Props = {
  agenda: Pick<
    AgendaViewState,
    | "view"
    | "setView"
    | "currentDate"
    | "filterProfessional"
    | "setFilterProfessional"
    | "filterSpecialty"
    | "setFilterSpecialty"
    | "shiftCalendar"
  >;
  professionals: ProfessionalAgendaRow[];
  specialties: { id: string; name: string }[];
};

export function AgendaToolbar({ agenda, professionals, specialties }: Props) {
  const {
    view,
    setView,
    currentDate,
    filterProfessional,
    setFilterProfessional,
    filterSpecialty,
    setFilterSpecialty,
    shiftCalendar,
  } = agenda;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex rounded-xl border border-slate-600/80 bg-slate-800/90 p-1 shadow-lg">
        {(["day", "week", "month"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize ${
              view === v
                ? "bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-900"
                : "text-slate-300 hover:bg-slate-700/80 hover:text-white"
            }`}
          >
            {v === "day" ? "Día" : v === "week" ? "Semana" : "Mes"}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
          onClick={() => shiftCalendar(true)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[180px] text-center text-sm font-medium capitalize text-slate-200">
          {view === "day"
            ? format(currentDate, "d 'de' MMMM yyyy", { locale: es })
            : format(currentDate, "MMMM yyyy", { locale: es })}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
          onClick={() => shiftCalendar(false)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

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
        className="w-48"
      />

      <Select
        options={[
          { value: "", label: "Todas las especialidades" },
          ...specialties.map((s) => ({ value: s.id, label: s.name })),
        ]}
        value={filterSpecialty}
        onChange={(e) => setFilterSpecialty(e.target.value)}
        className="w-48"
      />

      <Link
        href="/turnos/nuevo"
        className="ml-auto inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
      >
        <Plus className="h-4 w-4" />
        Nuevo turno
      </Link>
    </div>
  );
}

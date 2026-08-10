"use client";

import { Search, Stethoscope } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { useDebouncedPacientesSearch } from "@/features/pacientes/hooks/use-debounced-pacientes-search";
import { resolvePacientesClearHref } from "@/features/pacientes/utils/pacientes-page-url";

import { Button } from "@/components/ui/button";

type Props = {
  q: string;
  patologia?: string;
  cobertura?: string;
  trailing?: ReactNode;
  onNavigatingChange?: (isNavigating: boolean) => void;
};

export function PacientesSearchForm({
  q,
  patologia = "",
  cobertura,
  trailing,
  onNavigatingChange,
}: Props) {
  const { query, setQuery, pathology, setPathology, submitSearch, isNavigating } =
    useDebouncedPacientesSearch(q, patologia, cobertura);

  useEffect(() => {
    onNavigatingChange?.(isNavigating);
  }, [isNavigating, onNavigatingChange]);
  const clearHref = resolvePacientesClearHref(q, cobertura, patologia);

  return (
    <div className="drflow-card-light rounded-2xl border-2 border-amber-400/90 bg-gradient-to-br from-amber-50 via-orange-50/40 to-blue-50 p-4 text-slate-900 shadow-md shadow-amber-200/40 ring-1 ring-amber-300/50">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-900/80">
        Buscador
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <form
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
          action="/pacientes"
          method="get"
          onSubmit={submitSearch}
        >
          {cobertura === "pami" ? <input type="hidden" name="cobertura" value="pami" /> : null}
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-amber-600" />
            <input
              name="q"
              type="search"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Apellido, nombre o DNI… (una letra filtra por apellido)"
              className="drflow-ui-input drflow-prominent-search-input w-full rounded-xl border-2 border-amber-300/90 bg-white py-2.5 pl-11 pr-3 text-sm font-medium text-slate-900 shadow-inner placeholder:font-normal placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-400/35"
            />
          </div>
          <div className="relative min-w-[200px] flex-1">
            <Stethoscope className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-amber-600" />
            <input
              name="patologia"
              type="search"
              autoComplete="off"
              value={pathology}
              onChange={(e) => setPathology(e.target.value)}
              placeholder="Patología o diagnóstico en historias…"
              className="drflow-ui-input drflow-prominent-search-input w-full rounded-xl border-2 border-amber-300/90 bg-white py-2.5 pl-11 pr-3 text-sm font-medium text-slate-900 shadow-inner placeholder:font-normal placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-400/35"
            />
          </div>
          <Button
            type="submit"
            className="bg-amber-500 text-white hover:bg-amber-600 focus-visible:ring-amber-400"
          >
            Buscar
          </Button>
          {clearHref ? (
            <Link href={clearHref}>
              <Button type="button" variant="outline" className="border-amber-200 bg-white/80">
                Limpiar
              </Button>
            </Link>
          ) : null}
        </form>
        {trailing ? <div className="flex flex-wrap items-center gap-2">{trailing}</div> : null}
      </div>
    </div>
  );
}

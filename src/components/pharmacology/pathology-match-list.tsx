"use client";

import { cn } from "@/lib/utils/cn";
import { EmptyState } from "@/components/ui/empty-state";
import type { PathologyBySymptomResult } from "@/types/pharmacology";
import { Activity, Loader2 } from "lucide-react";

interface PathologyMatchListProps {
  items: PathologyBySymptomResult[];
  loading: boolean;
  error: string | null;
  symptomCount: number;
  onSelect: (pathology: PathologyBySymptomResult) => void;
  selectedId?: string | null;
}

export function PathologyMatchList({
  items,
  loading,
  error,
  symptomCount,
  onSelect,
  selectedId,
}: PathologyMatchListProps) {
  if (symptomCount === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="Agregá al menos un síntoma"
        description="Seleccioná la presentación clínica del paciente. DrFlow sugerirá patologías CIE-10 compatibles."
        className="bg-white"
      />
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-12">
        <Loader2 className="h-7 w-7 animate-spin text-violet-600" />
        <p className="mt-3 text-sm text-slate-500">Buscando patologías compatibles...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="Sin patologías sugeridas"
        description="No hay coincidencias en la guía para esa combinación de síntomas. Probá agregar otros o buscá por patología directamente."
        className="bg-white"
      />
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
        <h3 className="text-sm font-semibold text-slate-800">Patologías sugeridas</h3>
        <p className="text-xs text-slate-500">
          Ordenadas por relevancia clínica · {symptomCount} síntoma(s) seleccionado(s)
        </p>
      </div>
      <ul className="divide-y divide-slate-100">
        {items.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onSelect(p)}
              className={cn(
                "flex w-full flex-col gap-2 px-5 py-4 text-left transition-colors hover:bg-violet-50/60",
                selectedId === p.id && "bg-violet-50 ring-1 ring-inset ring-violet-200"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="font-medium text-slate-900">{p.name}</span>
                <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-xs font-semibold text-blue-800">
                  {p.cie10_code}
                </span>
              </div>
              {p.description && (
                <p className="text-sm text-slate-600">{p.description}</p>
              )}
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-800">
                  {p.match_count} síntoma(s) coincidente(s)
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                  Score {p.relevance_score}
                </span>
              </div>
              {p.matched_symptoms?.length > 0 && (
                <p className="text-xs text-slate-500">
                  Coincide con: {p.matched_symptoms.join(", ")}
                </p>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

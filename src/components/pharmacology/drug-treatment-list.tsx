"use client";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TREATMENT_LINE_LABELS, type PathologyDrug, type PharmacologySearchMode } from "@/types/pharmacology";
import { AlertTriangle, Pill, Loader2 } from "lucide-react";

interface DrugTreatmentListProps {
  items: PathologyDrug[];
  loading: boolean;
  error: string | null;
  pathologyName?: string;
  cie10Code?: string;
  searchMode?: PharmacologySearchMode;
}

function groupByTreatmentLine(items: PathologyDrug[]) {
  const groups = new Map<number, PathologyDrug[]>();
  for (const item of items) {
    const line = item.treatment_line;
    if (!groups.has(line)) groups.set(line, []);
    groups.get(line)!.push(item);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a - b);
}

export function DrugTreatmentList({
  items,
  loading,
  error,
  pathologyName,
  cie10Code,
  searchMode = "pathology",
}: DrugTreatmentListProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="mt-3 text-sm text-slate-500">Cargando fármacos asociados...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
        <p className="mt-2 text-sm font-medium text-red-800">{error}</p>
      </div>
    );
  }

  if (!pathologyName) {
    return (
      <EmptyState
        icon={Pill}
        title={searchMode === "symptoms" ? "Elegí una patología sugerida" : "Seleccioná una patología"}
        description={
          searchMode === "symptoms"
            ? "Agregá síntomas, elegí una patología de la lista y verás los fármacos de referencia asociados."
            : "Usá el buscador para encontrar una enfermedad por nombre o código CIE-10. Se mostrarán los fármacos de referencia asociados."
        }
        className="bg-white"
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Pill}
        title="Sin fármacos registrados"
        description={`No hay tratamientos de referencia cargados para ${pathologyName} (${cie10Code}).`}
        className="bg-white"
      />
    );
  }

  const groups = groupByTreatmentLine(items);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900">
        <strong>Referencia orientativa:</strong> Esta información no sustituye guías clínicas oficiales,
        formularios institucionales ni el criterio médico. Verificar interacciones, contraindicaciones y
        vademécum local antes de prescribir.
      </div>

      {groups.map(([line, drugs]) => (
        <section key={line} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-800">
              {TREATMENT_LINE_LABELS[line] ?? `Línea ${line}`}
            </h3>
            <p className="text-xs text-slate-500">{drugs.length} fármaco(s)</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {drugs.map((pd) => {
              const drug = Array.isArray(pd.drugs) ? pd.drugs[0] : pd.drugs;
              if (!drug) return null;
              return (
                <li key={pd.id} className="px-5 py-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{drug.name}</p>
                      <p className="text-sm text-slate-600">{drug.active_ingredient}</p>
                    </div>
                    <Badge variant="teal" className="font-mono text-xs">
                      {drug.atc_code}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    {drug.atc_description && (
                      <div>
                        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Clase ATC
                        </span>
                        <p className="text-slate-700">{drug.atc_description}</p>
                      </div>
                    )}
                    {drug.presentation && (
                      <div>
                        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Presentación
                        </span>
                        <p className="text-slate-700">{drug.presentation}</p>
                      </div>
                    )}
                    {drug.route && (
                      <div>
                        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Vía
                        </span>
                        <p className="text-slate-700 capitalize">{drug.route}</p>
                      </div>
                    )}
                    {pd.dosage_reference && (
                      <div>
                        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Dosis ref.
                        </span>
                        <p className="text-slate-700">{pd.dosage_reference}</p>
                      </div>
                    )}
                  </div>
                  {pd.indication_notes && (
                    <p className="mt-2 text-xs text-blue-800 bg-blue-50 rounded-md px-3 py-2">
                      {pd.indication_notes}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

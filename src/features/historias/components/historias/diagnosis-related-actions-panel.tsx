"use client";

import { Lightbulb, X } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/shared/utils/cn";

import {
  relatedActionToTreatmentEntry,
  treatmentAlreadyIncludesAction,
} from "@/features/historias/clinical-suggestions/apply-related-action";
import { resolveRelatedActionsForDiagnoses } from "@/features/historias/clinical-suggestions/resolve-related-actions";
import type { ResolvedRelatedAction } from "@/features/historias/clinical-suggestions/types";
import type {
  ClinicalDiagnosisEntry,
  ClinicalTreatmentEntry,
} from "@/features/historias/utils/clinical-structured-entries";

import { Button } from "@/components/ui/button";

type Props = {
  diagnoses: ClinicalDiagnosisEntry[];
  treatments: ClinicalTreatmentEntry[];
  onTreatmentsChange: (treatments: ClinicalTreatmentEntry[]) => void;
  className?: string;
};

/**
 * Accesos rápidos por diagnóstico. Nunca auto-selecciona ni persiste sin confirmación.
 */
export function DiagnosisRelatedActionsPanel({
  diagnoses,
  treatments,
  onTreatmentsChange,
  className,
}: Props) {
  const [pending, setPending] = useState<ResolvedRelatedAction | null>(null);

  const suggestions = useMemo(
    () => resolveRelatedActionsForDiagnoses(diagnoses),
    [diagnoses]
  );

  if (suggestions.length === 0) return null;

  const relatedDiagnosisLabel =
    [...new Set(suggestions.flatMap((s) => s.fromDiagnosisNames))].join(", ") ||
    diagnoses.map((d) => d.name).filter(Boolean).join(", ");

  function requestConfirm(action: ResolvedRelatedAction) {
    if (treatmentAlreadyIncludesAction(treatments, action)) return;
    setPending(action);
  }

  function cancelConfirm() {
    setPending(null);
  }

  function confirmPending() {
    if (!pending) return;
    if (treatmentAlreadyIncludesAction(treatments, pending)) {
      setPending(null);
      return;
    }
    onTreatmentsChange([...treatments, relatedActionToTreatmentEntry(pending)]);
    setPending(null);
  }

  return (
    <div
      className={cn(
        "rounded-md border border-dashed border-amber-300/80 bg-amber-50/60 p-3",
        className
      )}
      role="region"
      aria-label="Acciones relacionadas sugeridas"
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-900">
            <Lightbulb className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Opciones relacionadas
            <span className="rounded-full border border-amber-300 bg-amber-100/80 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-amber-800">
              Sugerencias
            </span>
          </p>
          <p className="mt-1 text-xs text-amber-900/80">
            Accesos rápidos para{" "}
            <span className="font-medium text-amber-950">{relatedDiagnosisLabel}</span>.
            No se agregan solos: el médico debe confirmar cada una.
          </p>
        </div>
      </div>

      <ul className="flex flex-wrap gap-1.5">
        {suggestions.map((action) => {
          const already = treatmentAlreadyIncludesAction(treatments, action);
          return (
            <li key={action.id}>
              <button
                type="button"
                disabled={already}
                onClick={() => requestConfirm(action)}
                title={
                  already
                    ? "Ya está en tratamiento / conducta"
                    : action.hint ?? "Confirmar para agregar al plan"
                }
                className={cn(
                  "inline-flex max-w-full items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs transition",
                  already
                    ? "cursor-default border-slate-200 bg-slate-50 text-slate-400"
                    : "border-amber-400/70 bg-white/80 text-amber-950 hover:border-amber-500 hover:bg-amber-100/70"
                )}
              >
                <span className="truncate font-medium">{action.label}</span>
                {already ? (
                  <span className="shrink-0 text-[10px] uppercase tracking-wide">Agregada</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {pending ? (
        <div
          className="drflow-modal-panel mt-3 rounded-md border border-amber-300 bg-white p-3 text-slate-900 shadow-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="related-action-confirm-title"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p
                id="related-action-confirm-title"
                className="text-sm font-semibold text-slate-900"
              >
                Confirmar acción
              </p>
              <p className="mt-1 text-xs text-slate-600">
                ¿Agregar <span className="font-medium text-slate-800">«{pending.label}»</span> a
                Tratamiento / conducta?
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                No genera receta ni dosis. Solo se guarda al confirmar.
              </p>
            </div>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={cancelConfirm}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={cancelConfirm}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={confirmPending}>
              Confirmar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

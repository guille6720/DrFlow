"use client";

import { Check, Copy, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { toast } from "@/core/notifications/toast";

import type { PhysicianAssistContext } from "@/features/ia/types/physician-assist-types";
import { PHYSICIAN_ASSIST_DISCLAIMER } from "@/features/ia/types/physician-assist-types";
import { useFeatureFlag } from "@/features/plugins/components/plugins/clinic-features-provider";

import { Button } from "@/components/ui/button";
import {
  buildCloseEncounterBundleText,
  buildCloseEncounterSteps,
  type CloseEncounterStep,
} from "@/lib/utils/close-encounter-assist";

type StepCardProps = {
  step: CloseEncounterStep;
  reviewed: boolean;
  onToggleReviewed: () => void;
  onCopy: () => void;
};

export function CloseEncounterStepCard({
  step,
  reviewed,
  onToggleReviewed,
  onCopy,
}: StepCardProps) {
  if (!step.item) {
    return (
      <div className="drflow-close-encounter-empty rounded-lg border border-dashed px-3 py-2 text-sm">
        <p className="font-medium">{step.title}</p>
        <p className="text-xs">Sin borrador disponible con la información actual.</p>
      </div>
    );
  }

  return (
    <div
      className={`drflow-close-encounter-card rounded-lg border p-3 ${
        reviewed ? "border-emerald-200 bg-emerald-50/50" : "border-violet-100 bg-white"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-900">{step.title}</p>
          <p className="text-xs text-slate-500">{step.description}</p>
        </div>
        <button
          type="button"
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
            reviewed
              ? "border-emerald-300 bg-emerald-100 text-emerald-800"
              : "border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
          onClick={onToggleReviewed}
        >
          <Check className="h-3 w-3" aria-hidden />
          {reviewed ? "Revisado" : "Marcar revisado"}
        </button>
      </div>
      <pre className="drflow-close-encounter-body mb-3 max-h-40 overflow-auto whitespace-pre-wrap font-sans text-sm">
        {step.item.body}
      </pre>
      <Button type="button" size="sm" variant="outline" onClick={onCopy}>
        <Copy className="h-3.5 w-3.5" />
        Copiar
      </Button>
    </div>
  );
}

type PanelProps = {
  patientName: string;
  context: PhysicianAssistContext;
  compact?: boolean;
};

/** Inline close-encounter drafts — confirm before copy/save (Phase D / J). */
export function CloseEncounterWizardPanel({ patientName, context, compact = false }: PanelProps) {
  const enabled = useFeatureFlag("consultation_assistant");
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});

  const steps = useMemo(
    () => buildCloseEncounterSteps({ ...context, patientName }),
    [context, patientName]
  );

  const availableSteps = steps.filter((s) => s.item);
  const allReviewed =
    availableSteps.length > 0 && availableSteps.every((s) => reviewed[s.id]);

  if (!enabled) {
    return (
      <p className="text-sm text-slate-600">
        Activá el asistente de consulta en configuración para ver borradores de cierre.
      </p>
    );
  }

  async function copyStep(step: CloseEncounterStep) {
    if (!step.item || typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(step.item.body);
    toast.copySuccess();
  }

  async function copyAll() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(buildCloseEncounterBundleText(steps));
    toast.copySuccess("Paquete copiado al portapapeles");
  }

  return (
    <div className="space-y-4">
      <div className="drflow-physician-assist-panel rounded-xl border p-3">
        <div className="drflow-physician-assist-title mb-1 flex items-center gap-1.5 text-sm font-medium">
          <Sparkles className="h-4 w-4" />
          Asistente de cierre
        </div>
        <p className="drflow-physician-assist-disclaimer text-xs">{PHYSICIAN_ASSIST_DISCLAIMER}</p>
        {!compact ? (
          <p className="mt-2 text-xs text-slate-600">
            Revisá cada borrador, copiá donde corresponda y confirmá antes de entregar al paciente.
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        {steps.map((step) => (
          <CloseEncounterStepCard
            key={step.id}
            step={step}
            reviewed={Boolean(reviewed[step.id])}
            onToggleReviewed={() =>
              setReviewed((prev) => ({ ...prev, [step.id]: !prev[step.id] }))
            }
            onCopy={() => void copyStep(step)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <Button type="button" disabled={availableSteps.length === 0} onClick={() => void copyAll()}>
          <Copy className="h-4 w-4" />
          Copiar todo el paquete
        </Button>
        {allReviewed ? (
          <span className="text-xs font-medium text-emerald-700">
            Todos los borradores revisados
          </span>
        ) : null}
      </div>
    </div>
  );
}

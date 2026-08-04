"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import { PatientWorkspaceOverlay } from "@/components/pacientes/workspace/patient-workspace-overlay";
import { Button } from "@/components/ui/button";
import { useFeatureFlag } from "@/components/plugins/clinic-plugins-provider";
import {
  buildCloseEncounterBundleText,
  buildCloseEncounterSteps,
  type CloseEncounterStep,
} from "@/lib/utils/close-encounter-assist";
import type { PhysicianAssistContext } from "@/lib/utils/physician-assist-types";
import { PHYSICIAN_ASSIST_DISCLAIMER } from "@/lib/utils/physician-assist-types";

type Props = {
  open: boolean;
  patientName: string;
  context: PhysicianAssistContext;
  onClose: () => void;
};

function StepCard({
  step,
  reviewed,
  onToggleReviewed,
  onCopy,
}: {
  step: CloseEncounterStep;
  reviewed: boolean;
  onToggleReviewed: () => void;
  onCopy: () => void;
}) {
  if (!step.item) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-500">
        <p className="font-medium text-slate-700">{step.title}</p>
        <p className="text-xs">Sin borrador disponible con la información actual.</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border p-3 ${reviewed ? "border-emerald-200 bg-emerald-50/50" : "border-violet-100 bg-white"}`}
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
      <pre className="mb-3 max-h-40 overflow-auto whitespace-pre-wrap font-sans text-sm text-slate-800">
        {step.item.body}
      </pre>
      <Button type="button" size="sm" variant="outline" onClick={onCopy}>
        <Copy className="h-3.5 w-3.5" />
        Copiar
      </Button>
    </div>
  );
}

/** Unified close-encounter wizard — all drafts confirmable before use (Phase D). */
export function CloseEncounterWizardSheet({ open, patientName, context, onClose }: Props) {
  const enabled = useFeatureFlag("consultation_assistant");
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});
  const [copiedAll, setCopiedAll] = useState(false);

  const steps = useMemo(
    () => buildCloseEncounterSteps({ ...context, patientName }),
    [context, patientName]
  );

  const availableSteps = steps.filter((s) => s.item);
  const allReviewed =
    availableSteps.length > 0 && availableSteps.every((s) => reviewed[s.id]);

  async function copyStep(step: CloseEncounterStep) {
    if (!step.item || typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(step.item.body);
  }

  async function copyAll() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(buildCloseEncounterBundleText(steps));
    setCopiedAll(true);
    window.setTimeout(() => setCopiedAll(false), 2000);
  }

  return (
    <PatientWorkspaceOverlay
      open={open}
      title="Generar cierre de consulta"
      subtitle={patientName}
      onClose={onClose}
      wide
    >
      {enabled ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-violet-900">
              <Sparkles className="h-4 w-4" />
              Asistente de cierre
            </div>
            <p className="text-xs text-violet-800">{PHYSICIAN_ASSIST_DISCLAIMER}</p>
            <p className="mt-2 text-xs text-slate-600">
              Revisá cada borrador, copiá donde corresponda (evolución, receta, orden, certificado) y
              confirmá antes de guardar o entregar al paciente.
            </p>
          </div>

          <div className="space-y-3">
            {steps.map((step) => (
              <StepCard
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

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <Button
              type="button"
              disabled={availableSteps.length === 0}
              onClick={() => void copyAll()}
            >
              <Copy className="h-4 w-4" />
              {copiedAll ? "Copiado" : "Copiar todo el paquete"}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
            {allReviewed ? (
              <span className="ml-auto text-xs font-medium text-emerald-700">
                Todos los borradores revisados
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-600">
          Activá el asistente de consulta en la configuración de la clínica para usar el wizard de cierre.
        </p>
      )}
    </PatientWorkspaceOverlay>
  );
}

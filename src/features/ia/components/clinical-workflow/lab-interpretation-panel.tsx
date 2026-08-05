"use client";

import { AlertTriangle, Copy, FlaskConical, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { PHYSICIAN_ASSIST_DISCLAIMER } from "@/features/ia/types/physician-assist-types";
import type { PatientChartExtras } from "@/features/pacientes/utils/patient-chart-model-types";
import { useFeatureFlag } from "@/features/plugins/components/plugins/clinic-features-provider";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  buildLabInterpretationItem,
  compareLabsWithHistory,
  parseLabValuesFromText,
} from "@/lib/utils/lab-interpretation";

type Props = {
  previousLabs?: PatientChartExtras["labs"];
  className?: string;
  /** When true, hides the paste textarea (e.g. sheet provides its own). */
  hideInput?: boolean;
  sourceText?: string;
  onSourceTextChange?: (text: string) => void;
};

/** Paste OCR / PDF lab text → structured comparison with chart history (Phase D). */
export function LabInterpretationPanel({
  previousLabs,
  className = "",
  hideInput = false,
  sourceText: controlledText,
  onSourceTextChange,
}: Props) {
  const enabled = useFeatureFlag("consultation_assistant");
  const [internalText, setInternalText] = useState("");
  const [copied, setCopied] = useState(false);

  const sourceText = controlledText ?? internalText;
  const setSourceText = onSourceTextChange ?? setInternalText;

  const parsed = useMemo(() => parseLabValuesFromText(sourceText), [sourceText]);
  const comparisons = useMemo(
    () => compareLabsWithHistory(parsed, previousLabs),
    [parsed, previousLabs]
  );
  const item = useMemo(
    () => buildLabInterpretationItem({ sourceText, previousLabs }),
    [sourceText, previousLabs]
  );

  if (!enabled) return null;

  async function handleCopy() {
    if (!item || typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(item.body);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  const abnormal = comparisons.filter((c) => c.status === "high" || c.status === "low");

  return (
    <section
      className={`rounded-xl border border-sky-100 bg-sky-50/60 p-4 ${className}`}
      aria-label="Interpretación de laboratorio"
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-sky-900">
        <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
        Interpretación de laboratorio
      </div>
      <p className="mb-3 text-xs text-sky-800">{PHYSICIAN_ASSIST_DISCLAIMER}</p>

      {!hideInput ? (
        <Textarea
          label="Pegá texto del PDF / OCR de laboratorio"
          rows={8}
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          placeholder="Ej: HbA1c 7.2 % · Glucemia 118 mg/dl · Creatinina 1.15 mg/dl"
          className="mb-3"
        />
      ) : null}

      {parsed.length === 0 && sourceText.trim().length > 20 ? (
        <p className="text-sm text-slate-600">
          No se detectaron valores reconocibles. Revisá el formato o pegá líneas con nombre y valor numérico.
        </p>
      ) : null}

      {comparisons.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <FlaskConical className="h-3.5 w-3.5" aria-hidden />
            Valores detectados ({comparisons.length})
          </div>

          <ul className="space-y-2">
            {comparisons.map((row) => {
              const tone =
                row.status === "high"
                  ? "border-red-200 bg-red-50/80"
                  : row.status === "low"
                    ? "border-amber-200 bg-amber-50/80"
                    : "border-slate-200 bg-white";
              return (
                <li key={row.name} className={`rounded-lg border px-3 py-2 text-sm ${tone}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-slate-900">{row.name}</span>
                    <span className="text-slate-800">{row.current}</span>
                  </div>
                  {row.deltaLabel ? (
                    <p className="mt-0.5 text-xs text-slate-600">{row.deltaLabel}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {abnormal.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                Fuera de rango
              </p>
              <ul className="list-inside list-disc text-sm text-amber-900">
                {abnormal.map((row) => (
                  <li key={row.name}>
                    {row.name} ({row.status === "high" ? "alto" : "bajo"})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {item ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void handleCopy()}>
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copiado" : "Copiar resumen"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

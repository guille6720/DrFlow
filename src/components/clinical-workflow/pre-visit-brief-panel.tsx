"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Copy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFeatureFlag } from "@/components/plugins/clinic-plugins-provider";
import { buildPreVisitBrief, type PreVisitBriefSection } from "@/lib/utils/pre-visit-brief";
import type { PatientChartPayload } from "@/lib/utils/patient-chart-types";

type Props = {
  patientName: string;
  chart: PatientChartPayload;
  lastConsultAt?: string | null;
  className?: string;
};

function SectionValue({ section }: { section: PreVisitBriefSection }) {
  const toneClass =
    section.tone === "critical"
      ? "text-red-700 font-medium"
      : section.tone === "warning"
        ? "text-amber-800 font-medium"
        : "text-slate-800";

  return <dd className={`text-sm ${toneClass}`}>{section.value}</dd>;
}

/** Auto-generated ~10 s clinical brief when opening patient workspace. */
export function PreVisitBriefPanel({ patientName, chart, lastConsultAt, className = "" }: Props) {
  const enabled = useFeatureFlag("consultation_assistant");
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const brief = useMemo(
    () => buildPreVisitBrief({ patientName, chart, lastConsultAt }),
    [patientName, chart, lastConsultAt]
  );

  if (!enabled) return null;

  async function handleCopy() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(brief.plainText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section
      className={`mx-0 rounded-xl border border-violet-100 bg-violet-50/60 ${className}`}
      aria-label="Resumen pre-consulta"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-violet-900">
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
          Resumen pre-consulta (~10 seg)
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-violet-700 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="border-t border-violet-100 px-4 pb-4 pt-3">
          <p className="mb-3 text-base font-semibold text-slate-900">{brief.headline}</p>

          <dl className="grid gap-2 sm:grid-cols-2">
            {brief.sections.map((section) => (
              <div key={section.label}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{section.label}</dt>
                <SectionValue section={section} />
              </div>
            ))}
          </dl>

          {brief.alertLines.length > 0 ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                Atención
              </p>
              <ul className="list-inside list-disc space-y-0.5 text-sm text-amber-900">
                {brief.alertLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-violet-800">
              Resumen automático basado en la historia — verificar antes de decidir.
            </p>
            <Button type="button" size="sm" variant="outline" onClick={() => void handleCopy()}>
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

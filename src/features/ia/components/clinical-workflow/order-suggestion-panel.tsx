"use client";

import type { PhysicianAssistContext } from "@/features/ia/types/physician-assist-types";

import { getMatchedOrderPanelLabels } from "@/lib/utils/medication-order-assist";

type Props = {
  context: PhysicianAssistContext;
  className?: string;
};

/** Preview of matched clinical order panels (Phase C). */
export function OrderSuggestionPanel({ context, className = "" }: Props) {
  const labels = getMatchedOrderPanelLabels(context);
  if (labels.length === 0) return null;

  return (
    <div className={`rounded-lg border border-teal-100 bg-teal-50/60 px-3 py-2 text-sm text-slate-700 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">Panel clínico detectado</p>
      <ul className="mt-1 list-inside list-disc space-y-0.5 text-teal-900">
        {labels.map((label) => (
          <li key={label}>{label}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-teal-800">Aplicá el borrador de orden y revisá cada estudio antes de emitir.</p>
    </div>
  );
}

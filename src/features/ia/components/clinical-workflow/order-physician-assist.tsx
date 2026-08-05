"use client";

import { useMemo } from "react";

import { InlinePhysicianAssist } from "@/features/ia/components/clinical-workflow/inline-physician-assist";
import { OrderSuggestionPanel } from "@/features/ia/components/clinical-workflow/order-suggestion-panel";
import type { PhysicianAssistContext, PhysicianAssistItem } from "@/features/ia/types/physician-assist-types";
import { useFeatureFlag } from "@/features/plugins/components/plugins/clinic-features-provider";

type Props = {
  context: PhysicianAssistContext;
  orderIntentText: string;
  onApplyOrderText: (text: string) => void;
};

const ORDER_KINDS = [
  "coverage_note",
  "follow_up_reminder",
  "order_draft",
  "interaction_alert",
] as const;

/** Order workflow — panels, coverage, follow-up (Phase C). */
export function OrderPhysicianAssist({ context, orderIntentText, onApplyOrderText }: Props) {
  const enabled = useFeatureFlag("consultation_assistant");

  const assistContext: PhysicianAssistContext = useMemo(
    () => ({
      ...context,
      orderIntentText,
    }),
    [context, orderIntentText]
  );

  if (!enabled) return null;

  const hasIntent = orderIntentText.trim().length >= 3;

  function handleApply(item: PhysicianAssistItem) {
    if (item.kind === "order_draft" || item.kind === "coverage_note" || item.kind === "follow_up_reminder") {
      onApplyOrderText(
        `${orderIntentText.trim()}\n\n--- ${item.title} (revisado) ---\n${item.body}`.trim()
      );
    }
  }

  return (
    <div className="space-y-2">
      {hasIntent ? (
        <>
          <OrderSuggestionPanel context={assistContext} />
          <InlinePhysicianAssist
            context={assistContext}
            kinds={[...ORDER_KINDS]}
            onApply={handleApply}
          />
        </>
      ) : (
        <p className="rounded-lg border border-dashed border-violet-200 bg-violet-50/40 px-3 py-2 text-xs text-violet-800">
          Escribí el motivo de la orden (ej. &quot;control de diabetes&quot;) para sugerir estudios.
        </p>
      )}
    </div>
  );
}

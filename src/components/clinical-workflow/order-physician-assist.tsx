"use client";

import { InlinePhysicianAssist } from "@/components/clinical-workflow/inline-physician-assist";
import type { PhysicianAssistContext, PhysicianAssistItem } from "@/lib/utils/physician-assist-types";
import { useFeatureFlag } from "@/components/plugins/clinic-plugins-provider";

type Props = {
  context: PhysicianAssistContext;
  onApplyOrderText: (text: string) => void;
};

export function OrderPhysicianAssist({ context, onApplyOrderText }: Props) {
  const enabled = useFeatureFlag("consultation_assistant");

  if (!enabled) return null;

  function handleApply(item: PhysicianAssistItem) {
    if (item.kind === "order_draft") {
      onApplyOrderText(item.body);
    }
  }

  return (
    <InlinePhysicianAssist
      context={context}
      kinds={["order_draft", "interaction_alert"]}
      onApply={handleApply}
    />
  );
}

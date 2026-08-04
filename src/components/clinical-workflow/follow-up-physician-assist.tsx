"use client";

import { InlinePhysicianAssist } from "@/components/clinical-workflow/inline-physician-assist";
import { useFeatureFlag } from "@/components/plugins/clinic-plugins-provider";
import type { PhysicianAssistContext } from "@/lib/utils/physician-assist-types";

type Props = {
  context: PhysicianAssistContext;
  onApplyNotes: (text: string) => void;
};

/** Follow-up step — suggests control timing; physician confirms before prefilling notes. */
export function FollowUpPhysicianAssist({ context, onApplyNotes }: Props) {
  const enabled = useFeatureFlag("consultation_assistant");
  if (!enabled) return null;

  return (
    <InlinePhysicianAssist
      context={context}
      kinds={["follow_up_reminder", "coverage_note"]}
      onApply={(item) => onApplyNotes(item.body)}
      compact
    />
  );
}

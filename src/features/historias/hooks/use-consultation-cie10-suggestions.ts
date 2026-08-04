"use client";

import { useMemo } from "react";
import {
  buildCie10Suggestions,
  extractCie10FromDifferentialBody,
} from "@/lib/utils/consultation-documentation";
import type { PhysicianAssistContext } from "@/features/ia/types/physician-assist-types";
import { buildDifferentialDiagnosisSuggestions } from "@/lib/utils/clinical-assistant";

/** Resolves merged CIE-10 suggestions for consultation UI. */
export function useConsultationCie10Suggestions(ctx: PhysicianAssistContext) {
  return useMemo(() => {
    const fromRules = buildCie10Suggestions(ctx);
    const differentialItems = buildDifferentialDiagnosisSuggestions(ctx);
    const fromDifferential = differentialItems.flatMap((item) =>
      extractCie10FromDifferentialBody(item.body)
    );

    const merged = [...fromRules];
    const seen = new Set(fromRules.map((s) => s.code));
    for (const s of fromDifferential) {
      if (seen.has(s.code)) continue;
      seen.add(s.code);
      merged.push(s);
    }

    return merged;
  }, [ctx]);
}

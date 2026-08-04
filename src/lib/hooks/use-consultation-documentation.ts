"use client";

import { useMemo } from "react";
import { buildConsultationDocumentationItems } from "@/lib/utils/consultation-documentation";
import { buildPhysicianAssistItems } from "@/lib/utils/clinical-assistant";
import type { PhysicianAssistContext, PhysicianAssistKind } from "@/lib/utils/physician-assist-types";

const DOCUMENTATION_KINDS: PhysicianAssistKind[] = [
  "evolution_draft",
  "physical_exam",
  "therapeutic_plan",
  "cie10_suggestion",
  "soap",
  "differential",
];

/** Unified documentation pipeline for typed or dictated evolution text. */
export function useConsultationDocumentation(
  ctx: PhysicianAssistContext,
  kinds: PhysicianAssistKind[] = DOCUMENTATION_KINDS
) {
  return useMemo(() => {
    const items = buildPhysicianAssistItems(ctx, kinds);
    const documentationOnly = buildConsultationDocumentationItems(ctx, kinds);
    const hasContent = (ctx.evolutionText ?? ctx.chiefComplaint ?? "").trim().length >= 12;

    return {
      items,
      documentationOnly,
      hasContent,
      evolutionLength: (ctx.evolutionText ?? "").trim().length,
    };
  }, [ctx, kinds]);
}

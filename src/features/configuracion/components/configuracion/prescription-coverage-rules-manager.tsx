"use client";

import { useState } from "react";

import { cn } from "@/shared/utils/cn";

import { PrescriptionCoverageRulesPanel } from "@/features/configuracion/components/configuracion/prescription-coverage-rules-panel";
import { COVERAGE_KINDS, type CoverageKind } from "@/features/recetas/engine/types";
import type { CoverageRuleRow } from "@/features/recetas/repositories/coverage-rules.repository";
import { coverageKindLabel } from "@/features/recetas/utils/coverage-rules-admin";

type Props = {
  savedRules: CoverageRuleRow[];
};

export function PrescriptionCoverageRulesManager({ savedRules }: Props) {
  const [activeKind, setActiveKind] = useState<CoverageKind>("PAMI");

  const savedByKind = (kind: CoverageKind) =>
    savedRules.find((row) => row.coverage_kind === kind) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {COVERAGE_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => setActiveKind(kind)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              activeKind === kind
                ? "bg-teal-700 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            )}
          >
            {coverageKindLabel(kind)}
            {savedByKind(kind) ? (
              <span
                className={cn(
                  "ml-1.5 text-xs",
                  activeKind === kind ? "text-teal-100" : "text-[var(--text-muted,#64748b)]"
                )}
              >
                · custom
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <PrescriptionCoverageRulesPanel
        key={activeKind}
        coverageKind={activeKind}
        savedRule={savedByKind(activeKind)}
      />
    </div>
  );
}

"use client";

import { BellRing, ChevronDown } from "lucide-react";
import { useMemo } from "react";

import { AddonUpgradeNotice } from "@/core/components/entitlements/addon-upgrade-notice";
import { useCanUseFeature } from "@/core/components/entitlements/entitlements-provider";
import { FEATURES } from "@/core/entitlements/features";

import { ProactiveCareContent } from "@/features/ia/components/clinical-workflow/proactive-care-content";
import type { PatientChartPayload } from "@/features/pacientes/utils/patient-chart-model-types";
import { useFeatureFlag } from "@/features/plugins/components/plugins/clinic-features-provider";

import {
  buildProactiveCareItems,
  countProactiveCareBySeverity,
} from "@/lib/utils/proactive-follow-up";

type Props = {
  patientId: string;
  chart: PatientChartPayload;
  lastConsultAt?: string | null;
  className?: string;
};

/** Proactive follow-up alerts for patient workspace (Phase E). */
export function ProactiveCarePanel({ patientId, chart, lastConsultAt, className = "" }: Props) {
  const flagEnabled = useFeatureFlag("consultation_assistant");
  const canAutomate = useCanUseFeature(FEATURES.AUTOMATION);
  const canFollowUp = useCanUseFeature(FEATURES.AUTOMATION_FOLLOW_UP);

  const items = useMemo(
    () => buildProactiveCareItems({ patientId, chart, lastConsultAt }),
    [patientId, chart, lastConsultAt]
  );

  const counts = useMemo(() => countProactiveCareBySeverity(items), [items]);

  if (!flagEnabled || items.length === 0) return null;

  if (!canAutomate || !canFollowUp) {
    return (
      <div className={`rounded-xl border border-amber-100 bg-amber-50/50 p-4 ${className}`}>
        <AddonUpgradeNotice
          feature={!canAutomate ? FEATURES.AUTOMATION : FEATURES.AUTOMATION_FOLLOW_UP}
        />
      </div>
    );
  }

  return (
    <details
      open
      className={`rounded-xl border border-amber-100 bg-amber-50/50 ${className}`}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 text-sm font-medium text-amber-950">
          <BellRing className="h-4 w-4 shrink-0" aria-hidden />
          Seguimiento proactivo
          {counts.high > 0 ? (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
              {counts.high} urgente{counts.high > 1 ? "s" : ""}
            </span>
          ) : null}
        </span>
        <ChevronDown className="h-4 w-4 text-amber-800" aria-hidden />
      </summary>

      <div className="border-t border-amber-100 px-4 pb-4 pt-3">
        <ProactiveCareContent items={items} />
      </div>
    </details>
  );
}

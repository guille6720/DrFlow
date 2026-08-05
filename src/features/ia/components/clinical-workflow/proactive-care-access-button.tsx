"use client";

import { BellRing } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/shared/utils/cn";

import { ProactiveCareSheet } from "@/features/ia/components/clinical-workflow/proactive-care-sheet";
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

/** Acceso compacto al seguimiento proactivo (barra de tabs del workspace). */
export function ProactiveCareAccessButton({
  patientId,
  chart,
  lastConsultAt,
  className,
}: Props) {
  const enabled = useFeatureFlag("consultation_assistant");
  const [open, setOpen] = useState(false);

  const items = useMemo(
    () => buildProactiveCareItems({ patientId, chart, lastConsultAt }),
    [patientId, chart, lastConsultAt]
  );

  const counts = useMemo(() => countProactiveCareBySeverity(items), [items]);

  if (!enabled || items.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "drflow-proactive-care-access inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-50/90 px-3 py-2 text-xs font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100",
          className
        )}
        aria-label={`Seguimiento proactivo, ${items.length} alerta${items.length > 1 ? "s" : ""}`}
      >
        <BellRing className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Seguimiento</span>
        {counts.high > 0 ? (
          <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {counts.high}
          </span>
        ) : (
          <span className="rounded-full bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-bold leading-none text-amber-950">
            {items.length}
          </span>
        )}
      </button>

      <ProactiveCareSheet
        open={open}
        onClose={() => setOpen(false)}
        items={items}
        urgentCount={counts.high}
      />
    </>
  );
}

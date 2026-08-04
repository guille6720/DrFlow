"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, BellRing, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFeatureFlag } from "@/components/plugins/clinic-plugins-provider";
import {
  buildProactiveCareItems,
  countProactiveCareBySeverity,
  type ProactiveCareItem,
} from "@/lib/utils/proactive-follow-up";
import type { PatientChartPayload } from "@/lib/utils/patient-chart-types";

type Props = {
  patientId: string;
  chart: PatientChartPayload;
  lastConsultAt?: string | null;
  className?: string;
};

function severityClass(severity: ProactiveCareItem["severity"]): string {
  if (severity === "high") return "border-red-200 bg-red-50/80";
  if (severity === "medium") return "border-amber-200 bg-amber-50/80";
  return "border-slate-200 bg-slate-50/80";
}

/** Proactive follow-up alerts for patient workspace (Phase E). */
export function ProactiveCarePanel({ patientId, chart, lastConsultAt, className = "" }: Props) {
  const enabled = useFeatureFlag("consultation_assistant");

  const items = useMemo(
    () => buildProactiveCareItems({ patientId, chart, lastConsultAt }),
    [patientId, chart, lastConsultAt]
  );

  const counts = useMemo(() => countProactiveCareBySeverity(items), [items]);

  if (!enabled || items.length === 0) return null;

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

      <div className="space-y-2 border-t border-amber-100 px-4 pb-4 pt-3">
        <p className="text-xs text-amber-900">
          Pacientes que requieren atención — revisar y decidir acción clínica.
        </p>
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className={`rounded-lg border px-3 py-2 text-sm ${severityClass(item.severity)}`}
            >
              <div className="flex items-start gap-2">
                {item.severity === "high" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <p className="text-slate-700">{item.detail}</p>
                  {item.actionHref ? (
                    <Link href={item.actionHref} className="mt-1 inline-block">
                      <Button type="button" size="sm" variant="outline">
                        {item.actionLabel ?? "Ver"}
                      </Button>
                    </Link>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

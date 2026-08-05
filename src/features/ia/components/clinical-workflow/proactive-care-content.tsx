"use client";

import { AlertTriangle } from "lucide-react";

import { SafeInternalLink } from "@/core/components/safe-link";

import { Button } from "@/components/ui/button";
import type { ProactiveCareItem } from "@/lib/utils/proactive-follow-up";

function severityClass(severity: ProactiveCareItem["severity"]): string {
  if (severity === "high") return "border-red-200 bg-red-50/80";
  if (severity === "medium") return "border-amber-200 bg-amber-50/80";
  return "border-slate-200 bg-slate-50/80";
}

type Props = {
  items: ProactiveCareItem[];
};

/** Lista de alertas de seguimiento proactivo (sheet o panel). */
export function ProactiveCareContent({ items }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-amber-900">
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
                  <SafeInternalLink href={item.actionHref} className="mt-1 inline-block">
                    <Button type="button" size="sm" variant="outline">
                      {item.actionLabel ?? "Ver"}
                    </Button>
                  </SafeInternalLink>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

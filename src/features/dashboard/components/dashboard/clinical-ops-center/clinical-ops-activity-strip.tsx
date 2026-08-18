import {
  AlertTriangle,
  CalendarClock,
  Clock,
  HeartPulse,
  UserCheck,
} from "lucide-react";

import { formatClinicDateTime } from "@/shared/utils/clinic-timezone";
import { cn } from "@/shared/utils/cn";

import type { ClinicalOperationsDashboardPayload } from "@/features/dashboard/utils/clinical-operations-dashboard-types";
import { EMPTY_CLINICAL_OPS_ACTIVITY } from "@/features/dashboard/utils/normalize-clinical-ops-payload";

export function ClinicalOpsActivityStrip({
  activity,
}: {
  activity?: ClinicalOperationsDashboardPayload["activity"];
}) {
  const metrics = activity ?? EMPTY_CLINICAL_OPS_ACTIVITY;
  const cards = [
    {
      label: "En espera",
      value: metrics.waitingCount,
      icon: Clock,
      tone: metrics.waitingCount > 0 ? "text-amber-300" : "text-slate-300",
    },
    {
      label: "Atendidos",
      value: metrics.attendedCount,
      icon: UserCheck,
      tone: "text-teal-300",
    },
    {
      label: "Espera prom.",
      value: metrics.averageWaitingMinutes != null ? `${metrics.averageWaitingMinutes} min` : "—",
      icon: HeartPulse,
      tone: "text-slate-300",
    },
    {
      label: "Próximo turno",
      value: metrics.nextAppointment
        ? formatClinicDateTime(metrics.nextAppointment.start_at, "HH:mm")
        : "—",
      icon: CalendarClock,
      tone: "text-teal-300",
    },
    {
      label: "Demorados",
      value: metrics.delayedCount,
      icon: AlertTriangle,
      tone: metrics.delayedCount > 0 ? "text-red-300" : "text-slate-300",
    },
  ];

  return (
    <section aria-label="Actividad de hoy" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      {cards.map(({ label, value, icon: Icon, tone }) => (
        <div
          key={label}
          className="drflow-card-light rounded-xl border border-slate-700/60 bg-slate-900/50 px-3 py-3"
        >
          <div className="flex items-center gap-2">
            <Icon className={cn("h-4 w-4 shrink-0", tone)} aria-hidden />
            <span className="text-xs text-slate-500">{label}</span>
          </div>
          <p className={cn("mt-1 text-xl font-bold tabular-nums", tone)}>{value}</p>
        </div>
      ))}
    </section>
  );
}

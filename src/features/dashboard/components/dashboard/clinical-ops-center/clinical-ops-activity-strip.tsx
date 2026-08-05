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

export function ClinicalOpsActivityStrip({
  activity,
}: {
  activity: ClinicalOperationsDashboardPayload["activity"];
}) {
  const cards = [
    {
      label: "En espera",
      value: activity.waitingCount,
      icon: Clock,
      tone: activity.waitingCount > 0 ? "text-amber-300" : "text-slate-300",
    },
    {
      label: "Atendidos",
      value: activity.attendedCount,
      icon: UserCheck,
      tone: "text-teal-300",
    },
    {
      label: "Espera prom.",
      value: activity.averageWaitingMinutes != null ? `${activity.averageWaitingMinutes} min` : "—",
      icon: HeartPulse,
      tone: "text-slate-300",
    },
    {
      label: "Próximo turno",
      value: activity.nextAppointment
        ? formatClinicDateTime(activity.nextAppointment.start_at, "HH:mm")
        : "—",
      icon: CalendarClock,
      tone: "text-teal-300",
    },
    {
      label: "Demorados",
      value: activity.delayedCount,
      icon: AlertTriangle,
      tone: activity.delayedCount > 0 ? "text-red-300" : "text-slate-300",
    },
  ];

  return (
    <section aria-label="Actividad de hoy" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      {cards.map(({ label, value, icon: Icon, tone }) => (
        <div
          key={label}
          className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-3 py-3"
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

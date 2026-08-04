"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { ClinicalOpsEmpty } from "@/components/dashboard/clinical-ops-empty";
import { OpsSection } from "@/components/dashboard/clinical-ops-center/clinical-ops-shared";
import type { ClinicalOperationsDashboardPayload } from "@/lib/utils/clinical-operations-dashboard-types";
import type { ClinicalOpsTask } from "@/lib/utils/clinical-operations-dashboard-types";
import { formatClinicDateTime } from "@/lib/utils/clinic-timezone";
import { cn } from "@/lib/utils/cn";

export function TodayTasksSection({
  tasks,
  onComplete,
}: {
  tasks: ClinicalOpsTask[];
  onComplete: (id: string) => void;
}) {
  return (
    <OpsSection id="ops-tasks" title="Tareas de hoy" count={tasks.length}>
      {tasks.length === 0 ? (
        <ClinicalOpsEmpty message="Sin tareas pendientes." />
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li
              key={task.id}
              className={cn(
                "flex items-start gap-2 rounded-lg border px-3 py-2",
                task.priority === "high"
                  ? "border-amber-700/50 bg-amber-950/20"
                  : "border-slate-700/50 bg-slate-900/30"
              )}
            >
              <button
                type="button"
                onClick={() => onComplete(task.id)}
                className="mt-0.5 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-teal-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50"
                aria-label={`Marcar completada: ${task.label}`}
              >
                <Check className="h-4 w-4" aria-hidden />
              </button>
              <div className="min-w-0 flex-1">
                <Link href={task.href} className="block hover:text-teal-300">
                  <p className="text-sm font-medium text-slate-100">{task.label}</p>
                  <p className="truncate text-xs text-slate-400">{task.detail}</p>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </OpsSection>
  );
}

export function TodayScheduleSection({
  appointments,
  canManageAppointments,
}: {
  appointments: ClinicalOperationsDashboardPayload["todayAppointments"];
  canManageAppointments: boolean;
}) {
  return (
    <OpsSection id="ops-schedule" title="Agenda de hoy" count={appointments.length}>
      {appointments.length === 0 ? (
        <ClinicalOpsEmpty message="Sin turnos programados para hoy." />
      ) : (
        <>
          <ul className="space-y-1 text-sm">
            {appointments.slice(0, 10).map((appt) => {
              const name = appt.patients
                ? `${appt.patients.last_name}, ${appt.patients.first_name}`
                : "Paciente";
              return (
                <li
                  key={appt.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-800/50"
                >
                  <span className="font-mono text-xs text-teal-400">
                    {formatClinicDateTime(appt.start_at, "HH:mm")}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-200">{name}</span>
                  <span className="text-xs capitalize text-slate-500">{appt.status}</span>
                </li>
              );
            })}
          </ul>
          {canManageAppointments && appointments.some((a) => a.status === "pending") ? (
            <p className="mt-2 text-xs text-amber-300">
              Hay solicitudes web pendientes de confirmación.
            </p>
          ) : null}
        </>
      )}
    </OpsSection>
  );
}

export function NotificationsSection({
  notifications,
}: {
  notifications: ClinicalOperationsDashboardPayload["notifications"];
}) {
  if (notifications.length === 0) return null;

  return (
    <OpsSection id="ops-notifications" title="Notificaciones" count={notifications.length}>
      <ul className="grid gap-2 sm:grid-cols-2">
        {notifications.map((n) => (
          <li key={n.id}>
            <Link
              href={n.href}
              className="flex items-start gap-2 rounded-lg border border-slate-700/50 px-3 py-2 transition hover:border-teal-700/50 hover:bg-slate-800/50"
            >
              <span className="text-sm font-medium text-slate-200">{n.label}</span>
              <span className="text-xs text-slate-500">{n.patientName}</span>
            </Link>
          </li>
        ))}
      </ul>
    </OpsSection>
  );
}

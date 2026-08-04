"use client";

import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, Bell, CheckSquare, Clock, FileStack, Pill } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ClinicalOpsEmpty } from "@/components/dashboard/clinical-ops-empty";
import type { ClinicalOpsTask } from "@/lib/utils/clinical-operations-dashboard-types";

const TASK_ICONS: Record<ClinicalOpsTask["kind"], typeof Clock> = {
  overdue_appointment: Clock,
  confirm_appointment: Bell,
  draft_prescription: Pill,
  pending_study: FileStack,
  queued_reminder: Bell,
};

export function ClinicalOpsTasksCard({ tasks }: { tasks: ClinicalOpsTask[] }) {
  return (
    <Card title="Tareas pendientes" className="h-full">
      {tasks.length === 0 ? (
        <ClinicalOpsEmpty message="Sin tareas operativas pendientes." />
      ) : (
        <ul className="space-y-2 text-sm">
          {tasks.map((task) => {
            const Icon = TASK_ICONS[task.kind];
            return (
              <li key={task.id}>
                <Link
                  href={task.href}
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2 transition hover:border-teal-200 hover:bg-teal-50/50 ${
                    task.priority === "high"
                      ? "border-amber-200 bg-amber-50/60"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <Icon
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      task.priority === "high" ? "text-amber-700" : "text-slate-500"
                    }`}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-900">{task.label}</span>
                    <span className="block truncate text-xs text-slate-500">{task.detail}</span>
                    <span className="block text-xs text-slate-400">
                      {format(new Date(task.at), "d MMM HH:mm", { locale: es })}
                    </span>
                  </span>
                  <CheckSquare className="ml-auto h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function ClinicalOpsCriticalAlertsCard({
  criticalPatients,
  overdueCount,
}: {
  criticalPatients: import("@/lib/utils/clinical-operations-types").ClinicalOperationsPayload["criticalPatients"];
  overdueCount: number;
}) {
  const hasAlerts = criticalPatients.length > 0 || overdueCount > 0;

  return (
    <Card title="Alertas críticas" className="h-full">
      {!hasAlerts ? (
        <ClinicalOpsEmpty message="Sin alertas clínicas ni demoras activas." />
      ) : (
        <ul className="space-y-2 text-sm">
          {overdueCount > 0 ? (
            <li className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <span>
                <span className="block font-medium text-amber-950">
                  {overdueCount} turno{overdueCount === 1 ? "" : "s"} demorado{overdueCount === 1 ? "" : "s"}
                </span>
                <Link href="/agenda?view=day" className="text-xs font-semibold text-amber-900 hover:underline">
                  Ver agenda del día →
                </Link>
              </span>
            </li>
          ) : null}
          {criticalPatients.map((p) => (
            <li key={p.id} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
                <span>
                  <p className="font-medium text-red-950">
                    {p.last_name}, {p.first_name}
                  </p>
                  <p className="text-xs text-red-800">{p.reason}</p>
                  <Link
                    href={`/pacientes/${p.id}?tab=resumen`}
                    className="mt-1 inline-block text-xs font-semibold text-red-900 hover:underline"
                  >
                    Abrir ficha →
                  </Link>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

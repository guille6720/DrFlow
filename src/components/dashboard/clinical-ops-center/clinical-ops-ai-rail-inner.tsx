"use client";

import Link from "next/link";
import type { ClinicalOperationsDashboardPayload } from "@/lib/utils/clinical-operations-dashboard-types";

type Props = {
  ops: ClinicalOperationsDashboardPayload;
};

/** Rule-based clinical day summary — no autonomous medical decisions. */
export function ClinicalOpsAiRailInner({ ops }: Props) {
  const reminders: string[] = [];

  if (ops.activity.delayedCount > 0) {
    reminders.push(`${ops.activity.delayedCount} turno(s) demorado(s) requieren atención.`);
  }
  if (ops.draftPrescriptions.length > 0) {
    reminders.push(`${ops.draftPrescriptions.length} receta(s) en borrador pendientes de firma.`);
  }
  if (ops.pendingOrders.length > 0) {
    reminders.push(`${ops.pendingOrders.length} orden(es) médica(s) sin emitir.`);
  }
  if (ops.criticalPatients.length > 0) {
    reminders.push(`Revisar alertas clínicas en ${ops.criticalPatients.length} paciente(s).`);
  }

  const followUps = ops.tasks
    .filter((t) => t.priority === "high")
    .slice(0, 4)
    .map((t) => ({ label: t.label, detail: t.detail, href: t.href }));

  const pendingDocs = ops.tasks.filter(
    (t) => t.kind === "draft_prescription" || t.kind === "pending_study"
  );

  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase text-slate-500">Resumen del día</h3>
        <ul className="space-y-1 text-slate-300">
          <li>{ops.activity.waitingCount} en espera · {ops.activity.attendedCount} atendidos</li>
          {ops.activity.averageWaitingMinutes != null ? (
            <li>Espera promedio: {ops.activity.averageWaitingMinutes} min</li>
          ) : null}
          <li>{ops.todayAppointments.length} turnos programados hoy</li>
        </ul>
      </div>

      {reminders.length > 0 ? (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase text-slate-500">Recordatorios</h3>
          <ul className="space-y-1.5">
            {reminders.map((r) => (
              <li key={r} className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-2 py-1.5 text-amber-100">
                {r}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {followUps.length > 0 ? (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase text-slate-500">Seguimientos sugeridos</h3>
          <ul className="space-y-1">
            {followUps.map((f) => (
              <li key={f.href + f.label}>
                <Link href={f.href} className="block rounded-lg px-2 py-1 text-teal-300 hover:bg-slate-800">
                  <span className="font-medium">{f.label}</span>
                  <span className="block truncate text-xs text-slate-500">{f.detail}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pendingDocs.length > 0 ? (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase text-slate-500">Documentación pendiente</h3>
          <ul className="space-y-1 text-slate-400">
            {pendingDocs.slice(0, 5).map((t) => (
              <li key={t.id}>
                <Link href={t.href} className="hover:text-teal-300 hover:underline">
                  {t.label}: {t.detail}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

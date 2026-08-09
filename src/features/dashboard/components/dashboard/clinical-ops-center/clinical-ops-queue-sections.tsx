import { AlertTriangle, Stethoscope } from "lucide-react";
import Link from "next/link";

import { formatClinicDateTime } from "@/shared/utils/clinic-timezone";
import { cn } from "@/shared/utils/cn";

import {
  OpsSection,
  PatientAvatar,
  PriorityBadge,
} from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-shared";
import { ClinicalOpsEmpty } from "@/features/dashboard/components/dashboard/clinical-ops-empty";
import type { ClinicalOperationsDashboardPayload } from "@/features/dashboard/utils/clinical-operations-dashboard-types";
import { patientWorkspacePath } from "@/features/pacientes/constants/patient-workspace-tabs";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

import { Button } from "@/components/ui/button";

export function WaitingQueueSection({
  rows,
  id = "ops-waiting",
  title = "Cola de espera",
  emptyMessage = "No hay pacientes en cola de atención.",
}: {
  rows: ClinicalOperationsDashboardPayload["enrichedWaiting"];
  id?: string;
  title?: string;
  emptyMessage?: string;
}) {
  return (
    <OpsSection id={id} title={title} count={rows.length}>
      {rows.length === 0 ? (
        <ClinicalOpsEmpty message={emptyMessage} />
      ) : (
        <WaitingQueueList rows={rows} />
      )}
    </OpsSection>
  );
}

export function UrgentPatientsSection({
  rows,
}: {
  rows: ClinicalOperationsDashboardPayload["urgentPatients"];
}) {
  return (
    <WaitingQueueSection
      id="ops-urgent"
      title="Pacientes urgentes"
      rows={rows}
      emptyMessage="No hay pacientes urgentes en espera."
    />
  );
}

function WaitingQueueList({
  rows,
}: {
  rows: ClinicalOperationsDashboardPayload["enrichedWaiting"];
}) {
  return (
    <ul className="space-y-3">
      {rows.map((row) => {
            const name = row.patients
              ? `${row.patients.last_name}, ${row.patients.first_name}`
              : "Paciente";
            const consultHref = row.patient_id
              ? buildPatientWorkspaceUrl(row.patient_id, {
                  tab: "soap",
                  action: "nueva",
                  appointment: row.id,
                  professional: row.professional_id ?? undefined,
                })
              : null;

            return (
              <li
                key={row.id}
                className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-3"
              >
                <div className="flex gap-3">
                  <PatientAvatar
                    firstName={row.patients?.first_name}
                    lastName={row.patients?.last_name}
                    priority={row.priority}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-100">{name}</p>
                      {row.age != null ? (
                        <span className="text-xs text-slate-500">{row.age} años</span>
                      ) : null}
                      <PriorityBadge priority={row.priority} />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Turno {formatClinicDateTime(row.start_at, "HH:mm")} hs · Espera{" "}
                      {row.waitingMinutes} min
                      {row.professionals?.profiles?.full_name
                        ? ` · ${row.professionals.profiles.full_name}`
                        : ""}
                    </p>
                    {row.notes?.trim() ? (
                      <p className="mt-1 text-xs text-slate-300">
                        <span className="text-slate-500">Motivo:</span> {row.notes.trim()}
                      </p>
                    ) : null}
                    {row.allergies?.trim() ? (
                      <p className="mt-1 text-xs font-medium text-red-300">
                        Alergias: {row.allergies.trim()}
                      </p>
                    ) : null}
                    {row.alerts.length > 0 ? (
                      <ul className="mt-1 flex flex-wrap gap-1">
                        {row.alerts.map((a) => (
                          <li
                            key={a}
                            className="rounded border border-amber-800/50 bg-amber-950/30 px-1.5 py-0.5 text-[10px] text-amber-200"
                          >
                            {a}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.patient_id ? (
                    <Link href={patientWorkspacePath(row.patient_id, "resumen")}>
                      <Button variant="outline" size="sm" type="button">
                        Abrir ficha
                      </Button>
                    </Link>
                  ) : null}
                  {consultHref ? (
                    <Link href={consultHref}>
                      <Button size="sm" type="button">
                        <Stethoscope className="h-3.5 w-3.5" aria-hidden />
                        Iniciar consulta
                      </Button>
                    </Link>
                  ) : null}
                  <Link href={`/agenda?view=day&highlight=${row.id}`}>
                    <Button variant="ghost" size="sm" type="button">
                      Reprogramar
                    </Button>
                  </Link>
                </div>
              </li>
            );
          })}
    </ul>
  );
}

export function CriticalAlertsSection({
  alerts,
}: {
  alerts: ClinicalOperationsDashboardPayload["actionableAlerts"];
}) {
  return (
    <OpsSection id="ops-alerts" title="Alertas críticas" count={alerts.length}>
      {alerts.length === 0 ? (
        <ClinicalOpsEmpty message="Sin alertas accionables en este momento." />
      ) : (
        <ul className="space-y-2">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className={cn(
                "rounded-lg border px-3 py-2",
                alert.severity === "critical"
                  ? "border-red-800/60 bg-red-950/40"
                  : alert.severity === "high"
                    ? "border-amber-800/60 bg-amber-950/30"
                    : "border-slate-700 bg-slate-900/30"
              )}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    alert.severity === "critical" ? "text-red-400" : "text-amber-400"
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-100">{alert.title}</p>
                  <p className="text-xs text-slate-400">{alert.detail}</p>
                  <Link
                    href={alert.href}
                    className="mt-1 inline-block text-xs font-semibold text-teal-400 hover:underline"
                  >
                    Tomar acción →
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </OpsSection>
  );
}

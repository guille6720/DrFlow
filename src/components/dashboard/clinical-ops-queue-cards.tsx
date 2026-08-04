"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, appointmentStatusBadge } from "@/components/ui/badge";
import { ClinicalOpsEmpty } from "@/components/dashboard/clinical-ops-empty";
import type { ClinicalOperationsPayload, LiveAppointment } from "@/lib/utils/clinical-operations-types";
import { buildPatientWorkspaceUrl } from "@/lib/utils/patient-workspace-actions";
import { patientClinicalHistoryPath } from "@/lib/utils/clinical-navigation";
import { formatClinicDateTime } from "@/lib/utils/clinic-timezone";

export function ClinicalOpsWaitingCard({ waiting }: { waiting: ClinicalOperationsPayload["waiting"] }) {
  return (
    <Card
      title="Pacientes en espera"
      className="h-full"
      action={
        <Link href="/sala-espera">
          <Button variant="outline" size="sm">
            Sala de espera
          </Button>
        </Link>
      }
    >
      {waiting.length === 0 ? (
        <ClinicalOpsEmpty message="No hay pacientes en cola de atención." />
      ) : (
        <ul className="space-y-2 text-sm">
          {waiting.slice(0, 8).map((row) => {
            const waitingLabel =
              row.waiting_room_status === "called"
                ? "Llamado"
                : row.waiting_room_status === "in_consultation"
                  ? "En consultorio"
                  : "En espera";
            return (
              <li key={row.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {row.patients
                      ? `${row.patients.last_name}, ${row.patients.first_name}`
                      : "Paciente"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatClinicDateTime(row.start_at, "HH:mm")} hs · {waitingLabel}
                  </p>
                </div>
                {row.patient_id ? (
                  <Link
                    href={buildPatientWorkspaceUrl(row.patient_id, {
                      tab: "soap",
                      action: "nueva",
                      appointment: row.id,
                      professional: (row as LiveAppointment).professional_id ?? undefined,
                    })}
                    className="shrink-0 text-xs font-semibold text-teal-700 hover:underline"
                  >
                    Atender
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function ClinicalOpsTodayAppointmentsCard({
  todayAppointments,
  canManageAppointments,
}: {
  todayAppointments: LiveAppointment[];
  canManageAppointments: boolean;
}) {
  return (
    <Card
      title="Turnos de hoy"
      className="h-full"
      action={
        <Link href="/agenda?view=day">
          <Button variant="outline" size="sm">
            Agenda
          </Button>
        </Link>
      }
    >
      {todayAppointments.length === 0 ? (
        <ClinicalOpsEmpty message="Sin turnos programados para hoy." />
      ) : (
        <ul className="space-y-2 text-sm">
          {todayAppointments.slice(0, 8).map((appt) => {
            const status = appointmentStatusBadge[appt.status as keyof typeof appointmentStatusBadge];
            const name = appt.patients
              ? `${appt.patients.last_name}, ${appt.patients.first_name}`
              : "Paciente";
            return (
              <li
                key={appt.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{name}</p>
                  <p className="text-xs text-slate-500">
                    {formatClinicDateTime(appt.start_at, "HH:mm")} hs
                    {appt.professionals?.profiles?.full_name
                      ? ` · ${appt.professionals.profiles.full_name}`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {status ? <Badge variant={status.variant}>{status.label}</Badge> : null}
                  {appt.patient_id ? (
                    <Link
                      href={patientClinicalHistoryPath(appt.patient_id)}
                      className="text-xs font-semibold text-teal-700 hover:underline"
                    >
                      Ficha
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {todayAppointments.length > 8 ? (
        <p className="mt-2 text-xs text-slate-500">
          +{todayAppointments.length - 8} turnos más en agenda
        </p>
      ) : null}
      {canManageAppointments && todayAppointments.some((a) => a.status === "pending") ? (
        <p className="mt-2 text-xs text-amber-800">Hay solicitudes web pendientes de confirmación.</p>
      ) : null}
    </Card>
  );
}

"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardUpcomingList } from "@/components/dashboard/dashboard-upcoming-list";
import { ClinicalOpsEmpty } from "@/components/dashboard/clinical-ops-empty";
import type { LiveAppointment } from "@/components/dashboard/consultorio-live-panel";
import type { ClinicalOperationsPayload } from "@/lib/utils/clinical-operations-types";
import { buildPatientWorkspaceUrl } from "@/lib/utils/patient-workspace-actions";
import { patientClinicalHistoryPath } from "@/lib/utils/clinical-navigation";
import { formatClinicDateTime } from "@/lib/utils/clinic-timezone";

export function ClinicalOpsWaitingCard({ waiting }: { waiting: ClinicalOperationsPayload["waiting"] }) {
  return (
    <Card title="Pacientes en espera hoy" className="h-full">
      {waiting.length === 0 ? (
        <ClinicalOpsEmpty message="No hay pacientes pendientes de atención." />
      ) : (
        <ul className="space-y-2 text-sm">
          {waiting.slice(0, 6).map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {row.patients
                    ? `${row.patients.last_name}, ${row.patients.first_name}`
                    : "Paciente"}
                </p>
                <p className="text-xs text-slate-500">{formatClinicDateTime(row.start_at, "HH:mm")} hs</p>
              </div>
              {row.patient_id ? (
                <Link href={patientClinicalHistoryPath(row.patient_id)} className="text-xs font-semibold text-teal-700 hover:underline">
                  Ver HC
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ClinicalOpsUpcomingCard({
  upcoming,
  canManageAppointments,
}: {
  upcoming: ClinicalOperationsPayload["upcoming"];
  canManageAppointments: boolean;
}) {
  return (
    <Card
      title="Turnos próximos"
      className="h-full"
      action={
        <Link href="/agenda">
          <Button variant="outline" size="sm">
            Agenda
          </Button>
        </Link>
      }
    >
      {upcoming.length === 0 ? (
        <ClinicalOpsEmpty message="Sin turnos próximos." />
      ) : (
        <DashboardUpcomingList
          appointments={upcoming.slice(0, 5) as LiveAppointment[]}
          canManage={canManageAppointments}
        />
      )}
    </Card>
  );
}

export function ClinicalOpsOverdueCard({ overdue }: { overdue: ClinicalOperationsPayload["overdue"] }) {
  return (
    <Card title="Urgencias / demoras" className="h-full">
      {overdue.length === 0 ? (
        <ClinicalOpsEmpty message="Sin turnos demorados." />
      ) : (
        <ul className="space-y-2 text-sm">
          {overdue.map((row) => (
            <li key={row.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="font-medium text-amber-950">
                {row.patients
                  ? `${row.patients.last_name}, ${row.patients.first_name}`
                  : "Paciente"}
              </p>
              <p className="text-xs text-amber-800">
                Programado {formatClinicDateTime(row.start_at, "HH:mm")} hs
              </p>
              {row.patient_id ? (
                <Link
                  href={buildPatientWorkspaceUrl(row.patient_id, {
                    tab: "soap",
                    action: "nueva",
                    appointment: row.id,
                  })}
                  className="mt-1 inline-block text-xs font-semibold text-amber-900 hover:underline"
                >
                  Atender ahora →
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ClinicalOpsCriticalPatientsCard({
  criticalPatients,
}: {
  criticalPatients: ClinicalOperationsPayload["criticalPatients"];
}) {
  return (
    <Card title="Pacientes críticos (hoy)" className="h-full">
      {criticalPatients.length === 0 ? (
        <ClinicalOpsEmpty message="Sin alertas de alergias o anticoagulación en la cola de hoy." />
      ) : (
        <ul className="space-y-2 text-sm">
          {criticalPatients.map((p) => (
            <li key={p.id} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="font-medium text-red-950">
                {p.last_name}, {p.first_name}
              </p>
              <p className="text-xs text-red-800">{p.reason}</p>
              <Link href={patientClinicalHistoryPath(p.id)} className="mt-1 inline-block text-xs font-semibold text-red-900 hover:underline">
                Abrir ficha →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

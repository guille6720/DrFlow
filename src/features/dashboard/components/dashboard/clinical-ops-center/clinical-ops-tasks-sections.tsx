import Link from "next/link";

import { formatClinicDateTime } from "@/shared/utils/clinic-timezone";

import { OpsSection } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-shared";
import { ClinicalOpsEmpty } from "@/features/dashboard/components/dashboard/clinical-ops-empty";
import type { ClinicalOperationsDashboardPayload } from "@/features/dashboard/utils/clinical-operations-dashboard-types";

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
  return (
    <OpsSection id="ops-notifications" title="Mensajes" count={notifications.length}>
      {notifications.length === 0 ? (
        <ClinicalOpsEmpty message="Sin mensajes operativos por ahora." />
      ) : (
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
      )}
    </OpsSection>
  );
}

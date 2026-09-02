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
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--surface-hover,#f1f5f9)]"
                >
                  <span className="font-mono text-xs text-teal-400">
                    {formatClinicDateTime(appt.start_at, "HH:mm")}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[var(--text-primary,#172033)]">{name}</span>
                  <span className="text-xs capitalize text-[var(--text-muted,#64748b)]">{appt.status}</span>
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
                className="flex items-start gap-2 rounded-lg border border-[var(--border-default,#e2e8f0)] px-3 py-2 transition hover:border-[var(--sidebar-accent,#0f766e)] hover:bg-[var(--surface-hover,#f1f5f9)]"
              >
                <span className="text-sm font-medium text-[var(--text-primary,#172033)]">{n.label}</span>
                <span className="text-xs text-[var(--text-muted,#64748b)]">{n.patientName}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </OpsSection>
  );
}

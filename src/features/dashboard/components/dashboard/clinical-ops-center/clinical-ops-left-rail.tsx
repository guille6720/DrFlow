import {
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  Clock,
  HeartPulse,
  MessageSquare,
  Plus,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { formatClinicDateTime } from "@/shared/utils/clinic-timezone";

import type { ClinicalOpsSectionId } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-scroll";
import { ClinicalOpsSectionNav } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-section-nav";
import type { ClinicalOperationsDashboardCorePayload } from "@/features/dashboard/utils/clinical-operations-dashboard-types";

const NAV = [
  { id: "ops-schedule", label: "Agenda de hoy", icon: CalendarDays },
  { id: "ops-waiting", label: "En espera", icon: Clock },
  { id: "ops-urgent", label: "Urgentes", icon: HeartPulse },
  { id: "ops-alerts", label: "Alertas críticas", icon: AlertTriangle },
  { id: "ops-tasks", label: "Tareas", icon: CheckSquare },
  { id: "ops-notifications", label: "Mensajes", icon: MessageSquare },
] as const satisfies ReadonlyArray<{
  id: ClinicalOpsSectionId;
  label: string;
  icon: typeof CalendarDays;
}>;

type Props = {
  ops: ClinicalOperationsDashboardCorePayload;
};

export function ClinicalOpsLeftRail({ ops }: Props) {
  const counts: Partial<Record<ClinicalOpsSectionId, number>> = {
    "ops-schedule": ops.todayAppointments?.length ?? 0,
    "ops-waiting": ops.enrichedWaiting?.length ?? 0,
    "ops-urgent": ops.urgentPatients?.length ?? 0,
    "ops-alerts": ops.actionableAlerts?.length ?? 0,
    "ops-tasks": undefined,
    "ops-notifications": ops.notifications?.length ?? 0,
  };

  return (
    <nav
      aria-label="Navegación operativa del día"
      className="drflow-sticky-rail flex flex-col gap-3 rounded-xl border border-slate-700/60 bg-slate-900/40 p-3"
    >
      <p className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Operaciones
      </p>
      <ClinicalOpsSectionNav items={NAV} counts={counts} />

      <div className="mt-2 border-t border-slate-700/60 pt-3">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Acciones rápidas
        </p>
        <ul className="space-y-1 text-sm">
          <li>
            <Link
              href="/pacientes/nuevo"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-teal-200"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Nuevo paciente
            </Link>
          </li>
          <li>
            <Link
              href="/turnos/nuevo"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-teal-200"
            >
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              Nuevo turno
            </Link>
          </li>
          <li>
            <Link
              href="/sala-espera"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-teal-200"
            >
              <Zap className="h-3.5 w-3.5" aria-hidden />
              Sala de espera
            </Link>
          </li>
        </ul>
      </div>

      {ops.activity?.nextAppointment ? (
        <div className="mt-auto rounded-lg border border-teal-800/40 bg-teal-950/30 p-2 text-xs text-teal-200">
          <p className="font-semibold">Próximo turno</p>
          <p className="mt-0.5 text-teal-100/90">
            {ops.activity.nextAppointment.patients
              ? `${ops.activity.nextAppointment.patients.last_name}, ${ops.activity.nextAppointment.patients.first_name}`
              : "Paciente"}{" "}
            · {formatClinicDateTime(ops.activity.nextAppointment.start_at, "HH:mm")} hs
          </p>
        </div>
      ) : null}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  Bell,
  Clock,
  FileStack,
  HeartPulse,
  Pill,
  ScrollText,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardUpcomingList } from "@/components/dashboard/dashboard-upcoming-list";
import type { LiveAppointment } from "@/components/dashboard/consultorio-live-panel";
import type { ClinicalOperationsPayload } from "@/lib/utils/clinical-operations-types";
import { patientClinicalHistoryPath } from "@/lib/utils/clinical-navigation";
import { patientWorkspacePath } from "@/lib/constants/patient-workspace-tabs";
import { formatClinicDateTime } from "@/lib/utils/clinic-timezone";

type Props = {
  ops: ClinicalOperationsPayload;
  canManageAppointments: boolean;
};

function OpsEmpty({ message }: { message: string }) {
  return <p className="text-sm text-slate-500">{message}</p>;
}

export function ClinicalOperationsCenter({ ops, canManageAppointments }: Props) {
  return (
    <section aria-label="Centro de operaciones clínicas" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Centro de operaciones clínicas</h2>
          <p className="text-sm text-slate-500">Solo lo que requiere acción hoy</p>
        </div>
        <Link href="/sala-espera">
          <Button variant="outline" size="sm">
            <Users className="h-4 w-4" />
            Sala de espera
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card title="Pacientes en espera hoy" className="h-full">
          {ops.waiting.length === 0 ? (
            <OpsEmpty message="No hay pacientes pendientes de atención." />
          ) : (
            <ul className="space-y-2 text-sm">
              {ops.waiting.slice(0, 6).map((row) => (
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
          {ops.upcoming.length === 0 ? (
            <OpsEmpty message="Sin turnos próximos." />
          ) : (
            <DashboardUpcomingList appointments={ops.upcoming.slice(0, 5) as LiveAppointment[]} canManage={canManageAppointments} />
          )}
        </Card>

        <Card title="Urgencias / demoras" className="h-full">
          {ops.overdue.length === 0 ? (
            <OpsEmpty message="Sin turnos demorados." />
          ) : (
            <ul className="space-y-2 text-sm">
              {ops.overdue.map((row) => (
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
                      href={`/historias/nueva?patient=${row.patient_id}&appointment=${row.id}`}
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

        <Card title="Pacientes críticos (hoy)" className="h-full">
          {ops.criticalPatients.length === 0 ? (
            <OpsEmpty message="Sin alertas de alergias o anticoagulación en la cola de hoy." />
          ) : (
            <ul className="space-y-2 text-sm">
              {ops.criticalPatients.map((p) => (
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

        <Card title="Recetas pendientes" className="h-full">
          {ops.draftPrescriptions.length === 0 ? (
            <OpsEmpty message="No hay borradores de receta." />
          ) : (
            <ul className="space-y-2 text-sm">
              {ops.draftPrescriptions.map((rx) => (
                <li key={rx.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                  <div>
                    <p className="font-medium">
                      {rx.patients
                        ? `${rx.patients.last_name}, ${rx.patients.first_name}`
                        : "Paciente"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {format(new Date(rx.created_at), "d MMM HH:mm", { locale: es })}
                    </p>
                  </div>
                  <Link href={`/recetas?patient=${rx.patient_id}`} className="text-xs font-semibold text-teal-700 hover:underline">
                    Emitir
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Estudios recientes (7 días)" className="h-full">
          {ops.pendingStudies.length === 0 ? (
            <OpsEmpty message="Sin archivos clínicos recientes." />
          ) : (
            <ul className="space-y-2 text-sm">
              {ops.pendingStudies.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.file_name}</p>
                    <p className="text-xs text-slate-500">
                      {s.patients ? `${s.patients.last_name}, ${s.patients.first_name}` : "Paciente"}
                    </p>
                  </div>
                  <Link href={patientWorkspacePath(s.patient_id, "archivos")} className="shrink-0 text-xs font-semibold text-teal-700 hover:underline">
                    Ver
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Notificaciones" className="h-full lg:col-span-2 xl:col-span-3">
          {ops.notifications.length === 0 ? (
            <OpsEmpty message="Sin novedades operativas hoy." />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ops.notifications.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 transition hover:border-teal-200 hover:bg-teal-50/50"
                  >
                    {n.kind === "overdue" ? (
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    ) : n.kind === "no_show" ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    ) : (
                      <Bell className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    )}
                    <span>
                      <span className="block text-sm font-medium text-slate-900">{n.label}</span>
                      <span className="block text-xs text-slate-500">{n.patientName}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
        <Badge variant="default" className="gap-1">
          <HeartPulse className="h-3 w-3" />
          {ops.waiting.length} en cola
        </Badge>
        <Badge variant="default" className="gap-1">
          <ScrollText className="h-3 w-3" />
          {ops.draftPrescriptions.length} recetas borrador
        </Badge>
        <Badge variant="default" className="gap-1">
          <FileStack className="h-3 w-3" />
          {ops.pendingStudies.length} archivos recientes
        </Badge>
        <Badge variant="default" className="gap-1">
          <Pill className="h-3 w-3" />
          {ops.criticalPatients.length} alertas clínicas
        </Badge>
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, Bell, Clock, FileStack, HeartPulse, Pill, ScrollText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClinicalOpsEmpty } from "@/components/dashboard/clinical-ops-empty";
import type { ClinicalOperationsPayload } from "@/lib/utils/clinical-operations-types";
import { patientWorkspacePath } from "@/lib/constants/patient-workspace-tabs";

export function ClinicalOpsDraftPrescriptionsCard({
  draftPrescriptions,
}: {
  draftPrescriptions: ClinicalOperationsPayload["draftPrescriptions"];
}) {
  return (
    <Card title="Recetas pendientes" className="h-full">
      {draftPrescriptions.length === 0 ? (
        <ClinicalOpsEmpty message="No hay borradores de receta." />
      ) : (
        <ul className="space-y-2 text-sm">
          {draftPrescriptions.map((rx) => (
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
  );
}

export function ClinicalOpsPendingStudiesCard({
  pendingStudies,
}: {
  pendingStudies: ClinicalOperationsPayload["pendingStudies"];
}) {
  return (
    <Card title="Estudios recientes (7 días)" className="h-full">
      {pendingStudies.length === 0 ? (
        <ClinicalOpsEmpty message="Sin archivos clínicos recientes." />
      ) : (
        <ul className="space-y-2 text-sm">
          {pendingStudies.map((s) => (
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
  );
}

export function ClinicalOpsNotificationsCard({
  notifications,
}: {
  notifications: ClinicalOperationsPayload["notifications"];
}) {
  return (
    <Card title="Notificaciones" className="h-full lg:col-span-2 xl:col-span-3">
      {notifications.length === 0 ? (
        <ClinicalOpsEmpty message="Sin novedades operativas hoy." />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {notifications.map((n) => (
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
  );
}

export function ClinicalOpsSummaryBadges({ ops }: { ops: ClinicalOperationsPayload }) {
  return (
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
  );
}

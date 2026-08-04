"use client";

import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { FileText, FlaskConical, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClinicalOpsEmpty } from "@/components/dashboard/clinical-ops-empty";
import { OpsSection } from "@/components/dashboard/clinical-ops-center/clinical-ops-shared";
import type { ClinicalOperationsDashboardPayload } from "@/lib/utils/clinical-operations-dashboard-types";
import { buildPatientWorkspaceUrl } from "@/lib/utils/patient-workspace-actions";
import { patientWorkspacePath } from "@/lib/constants/patient-workspace-tabs";
import { cn } from "@/lib/utils/cn";

export function PrescriptionsAndOrdersSections({
  draftPrescriptions,
  pendingOrders,
}: {
  draftPrescriptions: ClinicalOperationsDashboardPayload["draftPrescriptions"];
  pendingOrders: ClinicalOperationsDashboardPayload["pendingOrders"];
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <OpsSection id="ops-prescriptions" title="Recetas pendientes" count={draftPrescriptions.length}>
        {draftPrescriptions.length === 0 ? (
          <ClinicalOpsEmpty message="No hay recetas pendientes de firma." />
        ) : (
          <ul className="space-y-2 text-sm">
            {draftPrescriptions.map((rx) => (
              <li
                key={rx.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700/50 bg-slate-900/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-100">
                    {rx.patients ? `${rx.patients.last_name}, ${rx.patients.first_name}` : "Paciente"}
                  </p>
                  <p className="text-xs text-slate-400">
                    <Pill className="mr-1 inline h-3 w-3" aria-hidden />
                    {rx.medicationsSummary} · {rx.status} ·{" "}
                    {format(new Date(rx.created_at), "d MMM HH:mm", { locale: es })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Link href={buildPatientWorkspaceUrl(rx.patient_id, { tab: "recetas", action: "nueva" })}>
                    <Button size="sm" variant="outline" type="button">
                      Revisar
                    </Button>
                  </Link>
                  <Link href={buildPatientWorkspaceUrl(rx.patient_id, { tab: "recetas", action: "nueva" })}>
                    <Button size="sm" type="button">
                      Firmar
                    </Button>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </OpsSection>

      <OpsSection id="ops-orders" title="Órdenes médicas pendientes" count={pendingOrders.length}>
        {pendingOrders.length === 0 ? (
          <ClinicalOpsEmpty message="No hay órdenes médicas pendientes." />
        ) : (
          <ul className="space-y-2 text-sm">
            {pendingOrders.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700/50 bg-slate-900/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-100">
                    {order.patients
                      ? `${order.patients.last_name}, ${order.patients.first_name}`
                      : "Paciente"}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    <FileText className="mr-1 inline h-3 w-3" aria-hidden />
                    {order.order_text} · {format(new Date(order.created_at), "d MMM HH:mm", { locale: es })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Link href={patientWorkspacePath(order.patient_id, "ordenes")}>
                    <Button size="sm" variant="outline" type="button">
                      Revisar
                    </Button>
                  </Link>
                  <Link href={patientWorkspacePath(order.patient_id, "ordenes")}>
                    <Button size="sm" type="button">
                      Aprobar
                    </Button>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </OpsSection>
    </div>
  );
}

export function LabResultsSection({
  items,
}: {
  items: ClinicalOperationsDashboardPayload["recentLabs"];
}) {
  const labs = items.filter((l) => l.isLab);

  return (
    <OpsSection id="ops-labs" title="Resultados de laboratorio recientes" count={labs.length}>
      {labs.length === 0 ? (
        <ClinicalOpsEmpty message="Sin resultados de laboratorio recientes para revisar." />
      ) : (
        <ul className="space-y-2 text-sm">
          {labs.slice(0, 8).map((lab) => (
            <li
              key={lab.id}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg border px-3 py-2",
                lab.severity === "review"
                  ? "border-amber-700/50 bg-amber-950/20"
                  : "border-slate-700/50 bg-slate-900/30"
              )}
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1 font-medium text-slate-100">
                  <FlaskConical className="h-3.5 w-3.5 shrink-0 text-teal-400" aria-hidden />
                  <span className="truncate">{lab.file_name}</span>
                </p>
                <p className="text-xs text-slate-400">
                  {lab.patients ? `${lab.patients.last_name}, ${lab.patients.first_name}` : "Paciente"} ·{" "}
                  {format(new Date(lab.created_at), "d MMM HH:mm", { locale: es })}
                </p>
              </div>
              <Link href={patientWorkspacePath(lab.patient_id, "estudios")}>
                <Button size="sm" variant="outline" type="button">
                  Abrir ficha
                </Button>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </OpsSection>
  );
}

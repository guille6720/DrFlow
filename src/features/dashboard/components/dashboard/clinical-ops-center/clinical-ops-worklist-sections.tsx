import { FileText, FlaskConical, Pill } from "lucide-react";
import Link from "next/link";

import { formatClinicDateTime } from "@/shared/utils/clinic-timezone";
import { cn } from "@/shared/utils/cn";

import { OpsSection } from "@/features/dashboard/components/dashboard/clinical-ops-center/clinical-ops-shared";
import { ClinicalOpsEmpty } from "@/features/dashboard/components/dashboard/clinical-ops-empty";
import type { ClinicalOperationsDashboardPayload } from "@/features/dashboard/utils/clinical-operations-dashboard-types";
import { patientWorkspacePath } from "@/features/pacientes/constants/patient-workspace-tabs";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

import { Button } from "@/components/ui/button";

export function PrescriptionsAndOrdersSections({
  draftPrescriptions = [],
  pendingOrders = [],
}: {
  draftPrescriptions?: ClinicalOperationsDashboardPayload["draftPrescriptions"];
  pendingOrders?: ClinicalOperationsDashboardPayload["pendingOrders"];
}) {
  const rxList = draftPrescriptions ?? [];
  const orderList = pendingOrders ?? [];

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <OpsSection id="ops-prescriptions" title="Recetas pendientes" count={rxList.length}>
        {rxList.length === 0 ? (
          <ClinicalOpsEmpty message="No hay recetas pendientes de firma." />
        ) : (
          <ul className="space-y-2 text-sm">
            {rxList.map((rx) => (
              <li
                key={rx.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-default,#e2e8f0)] bg-[var(--surface-hover,#f1f5f9)] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[var(--text-primary,#172033)]">
                    {rx.patients ? `${rx.patients.last_name}, ${rx.patients.first_name}` : "Paciente"}
                  </p>
                  <p className="text-xs text-[var(--text-muted,#64748b)]">
                    <Pill className="mr-1 inline h-3 w-3" aria-hidden />
                    {rx.medicationsSummary} · {rx.status} ·{" "}
                    {formatClinicDateTime(rx.created_at, "d MMM HH:mm")}
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

      <OpsSection id="ops-orders" title="Órdenes médicas pendientes" count={orderList.length}>
        {orderList.length === 0 ? (
          <ClinicalOpsEmpty message="No hay órdenes médicas pendientes." />
        ) : (
          <ul className="space-y-2 text-sm">
            {orderList.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-default,#e2e8f0)] bg-[var(--surface-hover,#f1f5f9)] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[var(--text-primary,#172033)]">
                    {order.patients
                      ? `${order.patients.last_name}, ${order.patients.first_name}`
                      : "Paciente"}
                  </p>
                  <p className="truncate text-xs text-[var(--text-muted,#64748b)]">
                    <FileText className="mr-1 inline h-3 w-3" aria-hidden />
                    {order.order_text} · {formatClinicDateTime(order.created_at, "d MMM HH:mm")}
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
  items = [],
}: {
  items?: ClinicalOperationsDashboardPayload["recentLabs"];
}) {
  const labs = (items ?? []).filter((l) => l.isLab);

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
                  : "border-[var(--border-default,#e2e8f0)] bg-[var(--surface-hover,#f1f5f9)]"
              )}
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1 font-medium text-[var(--text-primary,#172033)]">
                  <FlaskConical className="h-3.5 w-3.5 shrink-0 text-teal-400" aria-hidden />
                  <span className="truncate">{lab.file_name}</span>
                </p>
                <p className="text-xs text-[var(--text-muted,#64748b)]">
                  {lab.patients ? `${lab.patients.last_name}, ${lab.patients.first_name}` : "Paciente"} ·{" "}
                  {formatClinicDateTime(lab.created_at, "d MMM HH:mm")}
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

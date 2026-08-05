import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus } from "lucide-react";
import Link from "next/link";

import type { PatientEhrWorkspaceData } from "@/features/pacientes/server/load-patient-ehr-data";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";
import { orderTypeLabel } from "@/features/recetas/utils/order-type-label";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Props = {
  ehr: PatientEhrWorkspaceData;
  patientId: string;
  canIssue: boolean;
};

export function PatientWorkspaceOrdersPanel({ ehr, patientId, canIssue }: Props) {
  return (
    <Card
      title="Órdenes médicas"
      action={
        canIssue ? (
          <Link href={buildPatientWorkspaceUrl(patientId, { tab: "ordenes", action: "nueva" })}>
            <Button size="sm" type="button">
              <Plus className="h-4 w-4" />
              Nueva orden
            </Button>
          </Link>
        ) : null
      }
    >
      {ehr.orders.length === 0 ? (
        <p className="text-sm text-slate-500">Sin órdenes emitidas.</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {ehr.orders.map((order) => (
            <li key={order.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-600">
                  {orderTypeLabel(order.order_type)}
                </span>
                <Badge variant={order.status === "void" ? "danger" : "success"}>
                  {order.status === "void" ? "Anulada" : "Emitida"}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {format(new Date(order.issued_at), "PPp", { locale: es })}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-slate-800">{order.order_text}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

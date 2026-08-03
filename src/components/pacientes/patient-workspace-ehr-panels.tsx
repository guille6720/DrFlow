"use client";

import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PatientEhrClinicalTables } from "@/components/historias/patient-ehr-clinical-tables";
import { PatientEhrView } from "@/components/historias/patient-ehr-view";
import type { PatientEhrWorkspaceData } from "@/lib/server/load-patient-ehr-data";
import { orderTypeLabel } from "@/components/recetas/prescriptions-orders-utils";
import { patientWorkspacePath } from "@/lib/constants/patient-workspace-tabs";

type EhrProps = {
  ehr: PatientEhrWorkspaceData;
  patientId: string;
};

export function PatientWorkspaceEhrPanel({ ehr, patientId }: EhrProps) {
  return (
    <PatientEhrView
      embedded
      patient={ehr.patientInfo}
      consultations={ehr.consultations}
      diagnosisRows={ehr.diagnosisRows}
      treatmentRows={ehr.treatmentRows}
      attachments={ehr.attachments}
      prescriptions={ehr.prescriptions}
      totalConsultations={ehr.totalConsultations}
      usesHceExport={ehr.usesHceExport}
    />
  );
}

export function PatientWorkspaceDiagnosticsPanel({ ehr, patientId }: EhrProps) {
  return (
    <Card title="Diagnósticos">
      <PatientEhrClinicalTables
        patientId={patientId}
        diagnosisRows={ehr.diagnosisRows}
        treatmentRows={ehr.treatmentRows}
        showDiagnostics
        showTreatments={false}
      />
      <Link href={patientWorkspacePath(patientId, "evoluciones")} className="mt-4 inline-block text-sm text-teal-700 hover:underline">
        Ver evoluciones completas →
      </Link>
    </Card>
  );
}

export function PatientWorkspacePrescriptionsPanel({ ehr, patientId, canIssue }: EhrProps & { canIssue: boolean }) {
  const issued = ehr.prescriptions;

  return (
    <Card
      title="Recetas"
      action={
        canIssue ? (
          <Link href={`/recetas?patient=${patientId}`}>
            <Button size="sm" type="button">
              <Plus className="h-4 w-4" />
              Nueva receta
            </Button>
          </Link>
        ) : null
      }
    >
      {issued.length === 0 ? (
        <p className="text-sm text-slate-500">Sin recetas emitidas para este paciente.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {issued.map((rx) => (
            <li key={rx.id} className="py-3">
              <p className="font-medium">{rx.label}</p>
              <p className="text-xs text-slate-500">
                {format(new Date(rx.created_at), "PPp", { locale: es })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function PatientWorkspaceOrdersPanel({ ehr, patientId, canIssue }: EhrProps & { canIssue: boolean }) {
  return (
    <Card
      title="Órdenes médicas"
      action={
        canIssue ? (
          <Link href={`/recetas?patient=${patientId}&tipo=orden`}>
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

export function PatientWorkspaceTimelinePanel({ ehr }: { ehr: PatientEhrWorkspaceData }) {
  const events = [
    ...ehr.consultations.map((c) => ({
      id: `c-${c.id}`,
      at: c.created_at,
      kind: "Consulta",
      title: c.diagnosis?.trim() || c.chief_complaint?.trim() || "Evolución",
      meta: c.professional_name,
    })),
    ...ehr.prescriptions.map((p) => ({
      id: `rx-${p.id}`,
      at: p.created_at,
      kind: "Receta",
      title: p.label,
      meta: "",
    })),
    ...ehr.orders.map((o) => ({
      id: `o-${o.id}`,
      at: o.issued_at,
      kind: "Orden",
      title: orderTypeLabel(o.order_type),
      meta: o.order_text.slice(0, 80),
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <Card title="Timeline clínico">
      {events.length === 0 ? (
        <p className="text-sm text-slate-500">Sin eventos clínicos registrados.</p>
      ) : (
        <ol className="space-y-3 border-l-2 border-teal-200 pl-4">
          {events.map((ev) => (
            <li key={ev.id} className="relative text-sm">
              <span className="absolute -left-[1.35rem] top-1.5 h-2.5 w-2.5 rounded-full bg-teal-500" />
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">{ev.kind}</p>
              <p className="font-medium text-slate-900">{ev.title}</p>
              <p className="text-xs text-slate-500">
                {format(new Date(ev.at), "PPp", { locale: es })}
                {ev.meta ? ` · ${ev.meta}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

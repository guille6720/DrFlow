"use client";

import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PatientEhrClinicalTables } from "@/features/historias/components/historias/patient-ehr-clinical-tables";
import { PatientEhrView } from "@/features/historias/components/historias/patient-ehr-view";
import type { PatientEhrWorkspaceData } from "@/features/pacientes/server/load-patient-ehr-data";
import { orderTypeLabel } from "@/features/recetas/utils/order-type-label";
import { PatientClinicalTimeline } from "@/features/pacientes/components/pacientes/patient-clinical-timeline";
import { patientWorkspacePath } from "@/features/pacientes/constants/patient-workspace-tabs";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

type EhrProps = {
  ehr: PatientEhrWorkspaceData;
  patientId: string;
};

export function PatientWorkspaceEhrPanel({ ehr, patientId: _patientId }: EhrProps) {
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
      <Link href={patientWorkspacePath(patientId, "soap")} className="mt-4 inline-block text-sm text-teal-700 hover:underline">
        Ver consultas SOAP →
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
          <Link href={buildPatientWorkspaceUrl(patientId, { tab: "recetas", action: "nueva" })}>
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

export function PatientWorkspaceTimelinePanel({ ehr }: { ehr: PatientEhrWorkspaceData }) {
  return <PatientClinicalTimeline ehr={ehr} />;
}

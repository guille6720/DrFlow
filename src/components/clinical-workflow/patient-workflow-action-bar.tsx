"use client";

import Link from "next/link";
import { CheckCircle2, ClipboardList, FileText, FlaskConical, LogOut, Pill, Sparkles, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { patientWorkflowHref } from "@/lib/utils/clinical-workflow-context";
import { buildPatientWorkspaceUrl } from "@/lib/utils/patient-workspace-actions";
import { CLINICAL_WORKFLOW_SHORTCUTS } from "@/lib/constants/clinical-workflow-shortcuts";

type Props = {
  patientId: string;
  canEditClinical: boolean;
  canIssue: boolean;
  activeAppointmentId?: string | null;
  onFinalizeConsult?: () => void;
  finalizing?: boolean;
};

function shortcutLabel(scope: "patient" | "consult", keys: string): string {
  const found = CLINICAL_WORKFLOW_SHORTCUTS.find((s) => s.keys === keys && s.scope === scope);
  return found?.keys.replace("Ctrl+", "⌃").replace("Shift+", "⇧").replace("Enter", "↵") ?? keys;
}

export function PatientWorkflowActionBar({
  patientId,
  canEditClinical,
  canIssue,
  activeAppointmentId,
  onFinalizeConsult,
  finalizing = false,
}: Props) {
  if (!canEditClinical && !canIssue) return null;

  return (
    <div className="drflow-patient-workflow-bar mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      {canEditClinical ? (
        <Link href={patientWorkflowHref(patientId, "soap")}>
          <Button size="sm" type="button" title={`Nueva SOAP (${shortcutLabel("patient", "Ctrl+Shift+N")})`}>
            <Stethoscope className="h-4 w-4" />
            SOAP
            <kbd className="ml-1 hidden rounded border border-slate-200 px-1 text-[10px] font-normal text-slate-500 sm:inline">
              {shortcutLabel("patient", "Ctrl+Shift+N")}
            </kbd>
          </Button>
        </Link>
      ) : null}
      {canIssue ? (
        <>
          <Link href={patientWorkflowHref(patientId, "prescription")}>
            <Button size="sm" variant="outline" type="button" title="Nueva receta (Ctrl+Shift+R)">
              <Pill className="h-4 w-4" />
              Receta
            </Button>
          </Link>
          <Link href={patientWorkflowHref(patientId, "order")}>
            <Button size="sm" variant="outline" type="button" title="Nueva orden (Ctrl+Shift+O)">
              <ClipboardList className="h-4 w-4" />
              Orden
            </Button>
          </Link>
          <Link href={buildPatientWorkspaceUrl(patientId, { action: "certificado" })}>
            <Button size="sm" variant="outline" type="button" title="Certificado médico">
              <FileText className="h-4 w-4" />
              Certificado
            </Button>
          </Link>
          <Link href={buildPatientWorkspaceUrl(patientId, { action: "alta" })}>
            <Button size="sm" variant="outline" type="button" title="Resumen de alta">
              <LogOut className="h-4 w-4" />
              Alta
            </Button>
          </Link>
          <Link href={buildPatientWorkspaceUrl(patientId, { action: "cerrar" })}>
            <Button size="sm" variant="outline" type="button" title="Wizard de cierre de consulta">
              <Sparkles className="h-4 w-4" />
              Generar cierre
            </Button>
          </Link>
          <Link href={buildPatientWorkspaceUrl(patientId, { tab: "estudios", action: "estudio" })}>
            <Button size="sm" variant="outline" type="button" title="Interpretar laboratorio (OCR / pegado)">
              <FlaskConical className="h-4 w-4" />
              Labs
            </Button>
          </Link>
        </>
      ) : null}
      {activeAppointmentId && onFinalizeConsult ? (
        <Button
          size="sm"
          variant="outline"
          type="button"
          loading={finalizing}
          onClick={onFinalizeConsult}
          title="Cerrar consulta (Ctrl+Shift+Enter)"
          className="ml-auto border-emerald-200 text-emerald-800 hover:bg-emerald-50"
        >
          <CheckCircle2 className="h-4 w-4" />
          Cerrar consulta
        </Button>
      ) : null}
    </div>
  );
}

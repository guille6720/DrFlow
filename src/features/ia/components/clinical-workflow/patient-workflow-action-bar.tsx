"use client";

import { CheckCircle2, ClipboardList, FileText, FlaskConical, LogOut, MessageSquare, Pill, Sparkles, Stethoscope } from "lucide-react";

import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

import { Button, ButtonLink } from "@/components/ui/button";
import { CLINICAL_WORKFLOW_SHORTCUTS } from "@/lib/constants/clinical-workflow-shortcuts";
import { patientWorkflowHref } from "@/lib/utils/clinical-workflow-context";

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
    <div className="drflow-patient-workflow-bar mb-3 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 shadow-sm">
      {canEditClinical ? (
        <ButtonLink
          href={patientWorkflowHref(patientId, "soap")}
          size="sm"
          title={`Nueva SOAP (${shortcutLabel("patient", "Ctrl+Shift+N")})`}
        >
          <Stethoscope className="h-4 w-4" />
          SOAP
          <kbd className="ml-1 hidden rounded border border-slate-200 px-1 text-[10px] font-normal text-slate-500 sm:inline">
            {shortcutLabel("patient", "Ctrl+Shift+N")}
          </kbd>
        </ButtonLink>
      ) : null}
      {canIssue ? (
        <>
          <ButtonLink
            href={patientWorkflowHref(patientId, "prescription")}
            size="sm"
            variant="outline"
            title="Nueva receta (Ctrl+Shift+R)"
          >
            <Pill className="h-4 w-4" />
            Receta
          </ButtonLink>
          <ButtonLink
            href={patientWorkflowHref(patientId, "order")}
            size="sm"
            variant="outline"
            title="Nueva orden (Ctrl+Shift+O)"
          >
            <ClipboardList className="h-4 w-4" />
            Orden
          </ButtonLink>
          <ButtonLink
            href={buildPatientWorkspaceUrl(patientId, { action: "certificado" })}
            size="sm"
            variant="outline"
            title="Certificado médico"
          >
            <FileText className="h-4 w-4" />
            Certificado
          </ButtonLink>
          <ButtonLink
            href={buildPatientWorkspaceUrl(patientId, { action: "alta" })}
            size="sm"
            variant="outline"
            title="Resumen de alta"
          >
            <LogOut className="h-4 w-4" />
            Alta
          </ButtonLink>
          <ButtonLink
            href={buildPatientWorkspaceUrl(patientId, { action: "cerrar" })}
            size="sm"
            variant="outline"
            title="Wizard de cierre de consulta"
          >
            <Sparkles className="h-4 w-4" />
            Generar cierre
          </ButtonLink>
          <ButtonLink
            href={buildPatientWorkspaceUrl(patientId, { tab: "estudios", action: "estudio" })}
            size="sm"
            variant="outline"
            title="Interpretar laboratorio (OCR / pegado)"
          >
            <FlaskConical className="h-4 w-4" />
            Labs
          </ButtonLink>
          <ButtonLink
            href={buildPatientWorkspaceUrl(patientId, { action: "copilot" })}
            size="sm"
            variant="outline"
            title="Copilot clínico conversacional"
          >
            <MessageSquare className="h-4 w-4" />
            Copilot
          </ButtonLink>
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

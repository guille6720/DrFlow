import { FileText, Plus } from "lucide-react";
import Link from "next/link";

import { cn } from "@/shared/utils/cn";

import { PatientEhrPrintMenu } from "@/features/historias/components/historias/patient-ehr-print-menu";
import type {
  PatientWorkspaceFocus,
  PatientWorkspaceSheet,
} from "@/features/pacientes/utils/patient-workspace-actions";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";

import { Button } from "@/components/ui/button";
import { EHR_NEW_CONSULT_FORM_ID } from "@/lib/utils/clinical-history-filename";

type Props = {
  patientId: string;
  consultOpen?: boolean;
  saveLoading?: boolean;
  activeSheet?: PatientWorkspaceSheet | null;
  activeFocus?: PatientWorkspaceFocus | null;
  canIssue?: boolean;
  selectedConsultaId?: string | null;
  onBeforeRecetaOpen?: () => void;
};

function consultUrl(
  patientId: string,
  opts?: { sheet?: PatientWorkspaceSheet; focus?: PatientWorkspaceFocus; consulta?: string }
) {
  if (opts?.sheet === "receta" && opts.consulta && !opts.focus) {
    return buildPatientWorkspaceUrl(patientId, {
      tab: "soap",
      consulta: opts.consulta,
      sheet: "receta",
    });
  }
  return buildPatientWorkspaceUrl(patientId, {
    tab: "soap",
    action: "nueva",
    sheet: opts?.sheet,
    focus: opts?.focus,
    consulta: opts?.consulta,
  });
}

export function PatientEhrActionLinks({
  patientId,
  consultOpen = false,
  saveLoading = false,
  activeSheet,
  activeFocus,
  canIssue = false,
  selectedConsultaId = null,
  onBeforeRecetaOpen,
}: Props) {
  const linkClass = (active: boolean) =>
    cn(
      "drflow-ehr-action-link inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition",
      active && "drflow-ehr-action-link-active"
    );

  const recetaHref = consultOpen
    ? consultUrl(patientId, { sheet: "receta" })
    : selectedConsultaId
      ? consultUrl(patientId, { sheet: "receta", consulta: selectedConsultaId })
      : consultUrl(patientId, { sheet: "receta" });

  return (
    <div className="drflow-ehr-actions mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--border)] pb-3 text-sm font-semibold">
      {!consultOpen ? (
        <Link href={consultUrl(patientId)} className="drflow-ehr-primary-btn">
          <Plus className="h-4 w-4" /> Nueva consulta
        </Link>
      ) : null}

      {canIssue ? (
        <Link
          href={recetaHref}
          onClick={onBeforeRecetaOpen}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition",
            activeSheet === "receta"
              ? "bg-teal-600 text-white shadow-sm"
              : "bg-gradient-to-r from-cyan-500 to-teal-600 text-white shadow-sm hover:from-cyan-600 hover:to-teal-700"
          )}
        >
          <Plus className="h-4 w-4" />
          Nueva receta
        </Link>
      ) : null}

      <Link
        href={consultUrl(patientId, { sheet: "archivo", focus: "evolucion" })}
        className={linkClass(activeSheet === "archivo")}
      >
        <Plus className="h-3.5 w-3.5" /> Archivo
      </Link>
      <Link
        href={consultUrl(patientId, { focus: "diagnostico" })}
        className={linkClass(activeFocus === "diagnostico")}
      >
        <Plus className="h-3.5 w-3.5" /> Diagnóstico
      </Link>
      <Link
        href={consultUrl(patientId, { focus: "vitales" })}
        className={linkClass(activeFocus === "vitales")}
      >
        Signos vitales
      </Link>
      {canIssue ? (
        <Link
          href={consultUrl(patientId, { sheet: "orden" })}
          className={linkClass(activeSheet === "orden")}
        >
          <FileText className="h-3.5 w-3.5" /> Orden
        </Link>
      ) : null}

      <div className="ml-auto flex items-center gap-3 print:hidden">
        {consultOpen ? (
          <Button type="submit" form={EHR_NEW_CONSULT_FORM_ID} size="sm" loading={saveLoading}>
            Guardar consulta
          </Button>
        ) : null}
        <PatientEhrPrintMenu />
      </div>
    </div>
  );
}

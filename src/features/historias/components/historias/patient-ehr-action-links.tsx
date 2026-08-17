import { FileText, Plus } from "lucide-react";
import Link from "next/link";

import { cn } from "@/shared/utils/cn";

import { PatientEhrPrintMenu } from "@/features/historias/components/historias/patient-ehr-print-menu";
import type {
  PatientWorkspaceFocus,
  PatientWorkspaceSheet,
} from "@/features/pacientes/utils/patient-workspace-actions";
import {
  buildConsultaSessionUrl,
  buildPatientWorkspaceUrl,
} from "@/features/pacientes/utils/patient-workspace-actions";

import { Button } from "@/components/ui/button";
import { EHR_NEW_CONSULT_FORM_ID } from "@/lib/utils/clinical-history-filename";

type ConsultHrefOpts = {
  sheet?: PatientWorkspaceSheet;
  focus?: PatientWorkspaceFocus;
  consulta?: string;
};

type Props = {
  patientId: string;
  consultOpen?: boolean;
  /** Historial clínico (HC): sin chips de evolución; solo listado + atajos. */
  historyOnly?: boolean;
  saveLoading?: boolean;
  activeSheet?: PatientWorkspaceSheet | null;
  activeFocus?: PatientWorkspaceFocus | null;
  canIssue?: boolean;
  selectedConsultaId?: string | null;
  onBeforeRecetaOpen?: () => void;
  /** Por defecto abre evolución en Médicos → Consultas. */
  buildHref?: (opts?: ConsultHrefOpts) => string;
};

export function PatientEhrActionLinks({
  patientId,
  consultOpen = false,
  historyOnly = false,
  saveLoading = false,
  activeSheet,
  activeFocus,
  canIssue = false,
  selectedConsultaId = null,
  onBeforeRecetaOpen,
  buildHref,
}: Props) {
  const consultUrl = (opts?: ConsultHrefOpts) =>
    buildHref?.(opts) ??
    buildConsultaSessionUrl({
      patient: patientId,
      sheet: opts?.sheet,
      focus: opts?.focus,
      consulta: opts?.consulta,
    });

  const linkClass = (active: boolean) =>
    cn(
      "drflow-ehr-action-link inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition",
      active && "drflow-ehr-action-link-active"
    );

  const recetaHref = historyOnly
    ? selectedConsultaId
      ? buildPatientWorkspaceUrl(patientId, {
          tab: "soap",
          consulta: selectedConsultaId,
          sheet: "receta",
        })
      : buildPatientWorkspaceUrl(patientId, { tab: "recetas", action: "nueva" })
    : consultOpen
      ? consultUrl({ sheet: "receta" })
      : selectedConsultaId
        ? consultUrl({ sheet: "receta", consulta: selectedConsultaId })
        : consultUrl({ sheet: "receta" });

  return (
    <div className="drflow-ehr-actions mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--border)] pb-3 text-sm font-semibold">
      {!consultOpen ? (
        <Link href={consultUrl()} className="drflow-ehr-primary-btn">
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

      {!historyOnly ? (
        <>
          <Link
            href={consultUrl({ sheet: "archivo", focus: "evolucion" })}
            className={linkClass(activeSheet === "archivo")}
          >
            <Plus className="h-3.5 w-3.5" /> Archivo
          </Link>
          <Link
            href={consultUrl({ focus: "diagnostico" })}
            className={linkClass(activeFocus === "diagnostico")}
          >
            <Plus className="h-3.5 w-3.5" /> Diagnóstico
          </Link>
          <Link
            href={consultUrl({ focus: "vitales" })}
            className={linkClass(activeFocus === "vitales")}
          >
            Signos vitales
          </Link>
          {canIssue ? (
            <Link
              href={consultUrl({ sheet: "orden" })}
              className={linkClass(activeSheet === "orden")}
            >
              <FileText className="h-3.5 w-3.5" /> Orden
            </Link>
          ) : null}
        </>
      ) : null}

      <div className="ml-auto flex items-center gap-3 print:hidden">
        {consultOpen ? (
          <Button
            type="submit"
            form={EHR_NEW_CONSULT_FORM_ID}
            size="sm"
            loading={saveLoading}
            pendingLabel="Guardando..."
          >
            Guardar consulta
          </Button>
        ) : null}
        <PatientEhrPrintMenu />
      </div>
    </div>
  );
}

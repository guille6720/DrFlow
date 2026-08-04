"use client";

import Link from "next/link";
import { Plus, Printer } from "lucide-react";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";
import { patientWorkspacePath } from "@/features/pacientes/constants/patient-workspace-tabs";

export function PatientEhrActionLinks({ patientId }: { patientId: string }) {
  return (
    <div className="drflow-ehr-actions flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--border)] pb-2 text-sm font-semibold">
      <Link
        href={patientWorkspacePath(patientId, "archivos")}
        className="drflow-ehr-action-link inline-flex items-center gap-1"
      >
        <Plus className="h-3.5 w-3.5" /> Archivo
      </Link>
      <Link
        href={buildPatientWorkspaceUrl(patientId, { tab: "soap", action: "nueva" })}
        className="drflow-ehr-action-link inline-flex items-center gap-1"
      >
        <Plus className="h-3.5 w-3.5" /> Diagnóstico
      </Link>
      <Link
        href={buildPatientWorkspaceUrl(patientId, { tab: "soap", action: "nueva" })}
        className="drflow-ehr-action-link inline-flex items-center gap-1"
      >
        <Plus className="h-3.5 w-3.5" /> Tratamiento
      </Link>
      <Link
        href={buildPatientWorkspaceUrl(patientId, { tab: "soap", action: "nueva" })}
        className="drflow-ehr-action-link inline-flex items-center gap-1"
      >
        Signos vitales
      </Link>
      <Link
        href={buildPatientWorkspaceUrl(patientId, { tab: "recetas", action: "nueva" })}
        className="drflow-ehr-action-link inline-flex items-center gap-1"
      >
        <Plus className="h-3.5 w-3.5" /> Receta
      </Link>
      <Link
        href={buildPatientWorkspaceUrl(patientId, { tab: "ordenes", action: "nueva" })}
        className="drflow-ehr-action-link inline-flex items-center gap-1"
      >
        <Plus className="h-3.5 w-3.5" /> Orden
      </Link>
      <button
        type="button"
        onClick={() => window.print()}
        className="drflow-ehr-action-muted ml-auto inline-flex items-center gap-1 print:hidden"
      >
        <Printer className="h-3.5 w-3.5" /> Imprimir
      </button>
    </div>
  );
}

"use client";

import { PatientWorkspaceOverlay } from "@/features/pacientes/components/pacientes/workspace/patient-workspace-overlay";
import { CloseEncounterWizardPanel } from "@/features/ia/components/clinical-workflow/close-encounter-wizard-panel";
import type { PhysicianAssistContext } from "@/features/ia/types/physician-assist-types";

type Props = {
  open: boolean;
  patientName: string;
  context: PhysicianAssistContext;
  onClose: () => void;
};

/** Standalone close-encounter wizard sheet (workspace action `?action=cerrar`). */
export function CloseEncounterWizardSheet({ open, patientName, context, onClose }: Props) {
  return (
    <PatientWorkspaceOverlay
      open={open}
      title="Generar cierre de consulta"
      subtitle={patientName}
      onClose={onClose}
      wide
    >
      <CloseEncounterWizardPanel patientName={patientName} context={context} />
      <div className="mt-4">
        <button
          type="button"
          className="text-sm text-slate-600 underline hover:text-slate-900"
          onClick={onClose}
        >
          Cerrar
        </button>
      </div>
    </PatientWorkspaceOverlay>
  );
}

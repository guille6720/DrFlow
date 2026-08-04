/** Keyboard shortcuts for clinical workflows (patient-centered). */
export const CLINICAL_WORKFLOW_SHORTCUTS = [
  { keys: "Ctrl+K", label: "Búsqueda global / pacientes", scope: "global" as const },
  { keys: "Ctrl+Shift+N", label: "Nueva SOAP (paciente actual)", scope: "patient" as const },
  { keys: "Ctrl+Shift+R", label: "Nueva receta (paciente actual)", scope: "patient" as const },
  { keys: "Ctrl+Shift+O", label: "Nueva orden (paciente actual)", scope: "patient" as const },
  { keys: "Ctrl+Shift+Enter", label: "Cerrar consulta (turno activo)", scope: "consult" as const },
  { keys: "Esc", label: "Cerrar panel / paleta", scope: "global" as const },
] as const;

export type ClinicalWorkflowShortcutScope = (typeof CLINICAL_WORKFLOW_SHORTCUTS)[number]["scope"];

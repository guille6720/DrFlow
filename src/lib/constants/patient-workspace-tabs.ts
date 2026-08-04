import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ClipboardList,
  FileStack,
  FlaskConical,
  HeartPulse,
  History,
  Pill,
  ScrollText,
  Shield,
  Sparkles,
  Stethoscope,
  Syringe,
} from "lucide-react";

export type PatientWorkspaceTabId =
  | "resumen"
  | "timeline"
  | "soap"
  | "diagnosticos"
  | "problemas"
  | "alergias"
  | "medicacion"
  | "recetas"
  | "ordenes"
  | "estudios"
  | "archivos"
  | "vacunas"
  | "auditoria"
  | "ia";

export type PatientWorkspaceTabDef = {
  id: PatientWorkspaceTabId;
  label: string;
  icon: LucideIcon;
  ready: boolean;
};

export const PATIENT_WORKSPACE_TABS: PatientWorkspaceTabDef[] = [
  { id: "resumen", label: "Resumen", icon: HeartPulse, ready: true },
  { id: "timeline", label: "Timeline", icon: History, ready: true },
  { id: "soap", label: "SOAP", icon: Stethoscope, ready: true },
  { id: "diagnosticos", label: "Diagnósticos", icon: ClipboardList, ready: true },
  { id: "problemas", label: "Problemas", icon: Activity, ready: true },
  { id: "alergias", label: "Alergias", icon: Shield, ready: true },
  { id: "medicacion", label: "Medicación", icon: Pill, ready: true },
  { id: "recetas", label: "Recetas", icon: ScrollText, ready: true },
  { id: "ordenes", label: "Órdenes", icon: FileStack, ready: true },
  { id: "estudios", label: "Estudios", icon: FlaskConical, ready: true },
  { id: "archivos", label: "Archivos", icon: FileStack, ready: true },
  { id: "vacunas", label: "Vacunas", icon: Syringe, ready: true },
  { id: "auditoria", label: "Auditoría", icon: Shield, ready: true },
  { id: "ia", label: "IA", icon: Sparkles, ready: true },
];

export const DEFAULT_PATIENT_WORKSPACE_TAB: PatientWorkspaceTabId = "resumen";

const TAB_IDS = new Set<string>([
  ...PATIENT_WORKSPACE_TABS.map((t) => t.id),
  "evoluciones",
  "vitales",
  "interconsultas",
]);

/** Maps legacy tab IDs to the patient-centered EMR tab model. */
export const LEGACY_TAB_ALIASES: Record<string, PatientWorkspaceTabId> = {
  evoluciones: "soap",
  historia: "soap",
  hc: "soap",
  vitales: "resumen",
  interconsultas: "resumen",
};

export function parsePatientWorkspaceTab(value: string | null | undefined): PatientWorkspaceTabId {
  if (value && TAB_IDS.has(value)) {
    const resolved = LEGACY_TAB_ALIASES[value] ?? value;
    if (PATIENT_WORKSPACE_TABS.some((t) => t.id === resolved)) {
      return resolved as PatientWorkspaceTabId;
    }
  }
  return DEFAULT_PATIENT_WORKSPACE_TAB;
}

export function patientWorkspacePath(patientId: string, tab: PatientWorkspaceTabId = "resumen"): string {
  if (tab === DEFAULT_PATIENT_WORKSPACE_TAB) return `/pacientes/${patientId}`;
  return `/pacientes/${patientId}?tab=${tab}`;
}

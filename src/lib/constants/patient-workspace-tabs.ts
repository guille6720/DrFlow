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
  Users,
} from "lucide-react";

export type PatientWorkspaceTabId =
  | "resumen"
  | "evoluciones"
  | "diagnosticos"
  | "problemas"
  | "medicacion"
  | "alergias"
  | "vitales"
  | "recetas"
  | "ordenes"
  | "estudios"
  | "archivos"
  | "vacunas"
  | "interconsultas"
  | "timeline"
  | "auditoria"
  | "ia";

export type PatientWorkspaceTabDef = {
  id: PatientWorkspaceTabId;
  label: string;
  icon: LucideIcon;
  /** Tabs with real content in Phase 4 */
  ready: boolean;
};

export const PATIENT_WORKSPACE_TABS: PatientWorkspaceTabDef[] = [
  { id: "resumen", label: "Resumen", icon: HeartPulse, ready: true },
  { id: "evoluciones", label: "Evoluciones", icon: Stethoscope, ready: true },
  { id: "diagnosticos", label: "Diagnósticos", icon: ClipboardList, ready: true },
  { id: "problemas", label: "Problemas", icon: Activity, ready: true },
  { id: "medicacion", label: "Medicación", icon: Pill, ready: true },
  { id: "alergias", label: "Alergias", icon: Shield, ready: true },
  { id: "vitales", label: "Signos vitales", icon: HeartPulse, ready: true },
  { id: "recetas", label: "Recetas", icon: ScrollText, ready: true },
  { id: "ordenes", label: "Órdenes", icon: FileStack, ready: true },
  { id: "estudios", label: "Estudios", icon: FlaskConical, ready: true },
  { id: "archivos", label: "Archivos", icon: FileStack, ready: true },
  { id: "vacunas", label: "Vacunas", icon: Syringe, ready: true },
  { id: "interconsultas", label: "Interconsultas", icon: Users, ready: false },
  { id: "timeline", label: "Timeline", icon: History, ready: true },
  { id: "auditoria", label: "Auditoría", icon: Shield, ready: true },
  { id: "ia", label: "IA", icon: Sparkles, ready: true },
];

export const DEFAULT_PATIENT_WORKSPACE_TAB: PatientWorkspaceTabId = "resumen";

const TAB_IDS = new Set(PATIENT_WORKSPACE_TABS.map((t) => t.id));

export function parsePatientWorkspaceTab(value: string | null | undefined): PatientWorkspaceTabId {
  if (value && TAB_IDS.has(value as PatientWorkspaceTabId)) {
    return value as PatientWorkspaceTabId;
  }
  return DEFAULT_PATIENT_WORKSPACE_TAB;
}

export function patientWorkspacePath(patientId: string, tab: PatientWorkspaceTabId = "resumen"): string {
  if (tab === DEFAULT_PATIENT_WORKSPACE_TAB) return `/pacientes/${patientId}`;
  return `/pacientes/${patientId}?tab=${tab}`;
}

/** Maps legacy EHR-only routes to workspace tabs. */
export const LEGACY_TAB_ALIASES: Record<string, PatientWorkspaceTabId> = {
  historia: "evoluciones",
  hc: "evoluciones",
};

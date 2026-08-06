import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ClipboardList,
  FileStack,
  FileText,
  FlaskConical,
  FolderOpen,
  HeartPulse,
  History,
  Pill,
  ScrollText,
  Shield,
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
  | "docs_admin"
  | "estudios"
  | "archivos"
  | "vacunas"
  | "auditoria";

/** Navigation-only id for the primary tab bar (maps to SOAP by default). */
export type PatientWorkspacePrimaryTabId = PatientWorkspaceTabId | "hc";

export type PatientWorkspaceTabDef = {
  id: PatientWorkspaceTabId;
  label: string;
  icon: LucideIcon;
  ready: boolean;
};

export type PatientWorkspacePrimaryTabDef = {
  id: PatientWorkspacePrimaryTabId;
  label: string;
  icon: LucideIcon;
  ready: boolean;
};

export const PATIENT_HC_SUB_TABS: PatientWorkspaceTabDef[] = [
  { id: "soap", label: "Historias clínicas", icon: Stethoscope, ready: true },
  { id: "recetas", label: "Recetas", icon: ScrollText, ready: true },
  { id: "ordenes", label: "Órdenes", icon: FileStack, ready: true },
  { id: "docs_admin", label: "Docs administrativos", icon: FolderOpen, ready: true },
];

export const HC_WORKSPACE_TAB_IDS = new Set<PatientWorkspaceTabId>(
  PATIENT_HC_SUB_TABS.map((tab) => tab.id)
);

export const DEFAULT_HC_WORKSPACE_TAB: PatientWorkspaceTabId = "soap";

export const PATIENT_WORKSPACE_PRIMARY_TABS: PatientWorkspacePrimaryTabDef[] = [
  { id: "resumen", label: "Resumen", icon: HeartPulse, ready: true },
  { id: "timeline", label: "Timeline", icon: History, ready: true },
  { id: "hc", label: "HC", icon: FileText, ready: true },
  { id: "diagnosticos", label: "Diagnósticos", icon: ClipboardList, ready: true },
  { id: "problemas", label: "Problemas", icon: Activity, ready: true },
  { id: "alergias", label: "Alergias", icon: Shield, ready: true },
  { id: "medicacion", label: "Medicación", icon: Pill, ready: true },
  { id: "estudios", label: "Estudios", icon: FlaskConical, ready: true },
  { id: "archivos", label: "Archivos", icon: FileStack, ready: true },
  { id: "vacunas", label: "Vacunas", icon: Syringe, ready: true },
  { id: "auditoria", label: "Auditoría", icon: Shield, ready: true },
];

/** @deprecated Use PATIENT_WORKSPACE_PRIMARY_TABS + PATIENT_HC_SUB_TABS */
export const PATIENT_WORKSPACE_TABS: PatientWorkspaceTabDef[] = [
  ...PATIENT_WORKSPACE_PRIMARY_TABS.filter((tab) => tab.id !== "hc").map((tab) => ({
    id: tab.id as PatientWorkspaceTabId,
    label: tab.label,
    icon: tab.icon,
    ready: tab.ready,
  })),
  ...PATIENT_HC_SUB_TABS,
];

export const DEFAULT_PATIENT_WORKSPACE_TAB: PatientWorkspaceTabId = "resumen";

const TAB_IDS = new Set<string>([
  ...PATIENT_WORKSPACE_PRIMARY_TABS.filter((tab) => tab.id !== "hc").map((tab) => tab.id),
  ...PATIENT_HC_SUB_TABS.map((tab) => tab.id),
  "evoluciones",
  "vitales",
  "interconsultas",
  "ia",
  "hc",
]);

/** Maps legacy tab IDs to the patient-centered EMR tab model. */
export const LEGACY_TAB_ALIASES: Record<string, PatientWorkspaceTabId> = {
  evoluciones: "soap",
  historia: "soap",
  hc: "soap",
  vitales: "resumen",
  interconsultas: "resumen",
  ia: "resumen",
};

export function isHcWorkspaceTab(tab: PatientWorkspaceTabId): boolean {
  return HC_WORKSPACE_TAB_IDS.has(tab);
}

export function isHcPrimaryTabActive(tab: PatientWorkspaceTabId): boolean {
  return isHcWorkspaceTab(tab);
}

export function parsePatientWorkspaceTab(value: string | null | undefined): PatientWorkspaceTabId {
  if (value && TAB_IDS.has(value)) {
    if (value === "hc") return DEFAULT_HC_WORKSPACE_TAB;
    const resolved = LEGACY_TAB_ALIASES[value] ?? value;
    if (
      PATIENT_WORKSPACE_PRIMARY_TABS.some(
        (tab) => tab.id !== "hc" && tab.id === resolved
      ) ||
      PATIENT_HC_SUB_TABS.some((tab) => tab.id === resolved)
    ) {
      return resolved as PatientWorkspaceTabId;
    }
  }
  return DEFAULT_PATIENT_WORKSPACE_TAB;
}

export function patientWorkspacePath(patientId: string, tab: PatientWorkspaceTabId = "resumen"): string {
  if (tab === DEFAULT_PATIENT_WORKSPACE_TAB) return `/pacientes/${patientId}`;
  return `/pacientes/${patientId}?tab=${tab}`;
}

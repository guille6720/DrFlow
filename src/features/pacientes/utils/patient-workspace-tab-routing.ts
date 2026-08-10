import type { PatientChartFocus } from "@/features/pacientes/components/pacientes/patient-workspace-chart-panel";
import type { PatientWorkspaceTabId } from "@/features/pacientes/constants/patient-workspace-tabs";
import { parsePatientWorkspaceActions } from "@/features/pacientes/utils/patient-workspace-actions";

export const CHART_FOCUS_BY_TAB: Partial<Record<PatientWorkspaceTabId, PatientChartFocus>> = {  problemas: "problemas",
  medicacion: "medicacion",
  alergias: "alergias",
  estudios: "estudios",
  archivos: "archivos",
  vacunas: "vacunas",
};

export const CLINICAL_CONTEXT_TABS = new Set<PatientWorkspaceTabId>(["resumen", "soap"]);

export function chartFocusForTab(tab: PatientWorkspaceTabId): PatientChartFocus | undefined {
  return CHART_FOCUS_BY_TAB[tab];
}

export function shouldLoadCopilotBridge(
  activeTab: PatientWorkspaceTabId,
  searchAction: string | null
): boolean {
  return CLINICAL_CONTEXT_TABS.has(activeTab) || searchAction === "copilot";
}

export function shouldLoadWorkspaceSheets(
  activeTab: PatientWorkspaceTabId,
  searchParams: URLSearchParams
): boolean {
  const parsed = parsePatientWorkspaceActions(activeTab, searchParams);
  return (
    parsed.consultSheetOpen ||
    parsed.inlineConsultOpen ||
    parsed.prescriptionSheetOpen ||
    parsed.orderSheetOpen ||
    parsed.archivoSheetOpen ||
    parsed.recordSheetOpen ||
    parsed.dischargeSheetOpen ||
    parsed.certificateSheetOpen ||
    parsed.closeEncounterSheetOpen ||
    parsed.labInterpretSheetOpen
  );
}
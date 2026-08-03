"use client";

import { PatientChartView } from "@/components/pacientes/patient-chart-view";
import { PatientWorkspaceTabBar } from "@/components/pacientes/patient-workspace-tab-bar";
import type { PatientWorkspaceViewProps } from "@/components/pacientes/patient-workspace-types";
import {
  PatientWorkspaceChartPanel,
  type PatientChartFocus,
} from "@/components/pacientes/patient-workspace-chart-panel";
import {
  PatientWorkspaceDiagnosticsPanel,
  PatientWorkspaceEhrPanel,
  PatientWorkspaceOrdersPanel,
  PatientWorkspacePrescriptionsPanel,
  PatientWorkspaceTimelinePanel,
} from "@/components/pacientes/patient-workspace-ehr-panels";
import { PatientWorkspacePlaceholderPanel } from "@/components/pacientes/patient-workspace-placeholder-panel";
import type { PatientWorkspaceTabId } from "@/lib/constants/patient-workspace-tabs";
import { usePatientWorkspaceTab } from "@/lib/hooks/use-patient-workspace-tab";

const CHART_FOCUS_TABS: Partial<Record<PatientWorkspaceTabId, PatientChartFocus>> = {
  problemas: "problemas",
  medicacion: "medicacion",
  alergias: "alergias",
  vitales: "vitales",
  estudios: "estudios",
  archivos: "archivos",
  vacunas: "vacunas",
};

export function PatientWorkspaceView(props: PatientWorkspaceViewProps) {
  const { ehr, initialTab, ...chartProps } = props;
  const { activeTab, setTab } = usePatientWorkspaceTab(chartProps.patientId, initialTab);

  const chartFocus = CHART_FOCUS_TABS[activeTab];

  return (
    <div className="drflow-patient-workspace">
      <PatientWorkspaceTabBar activeTab={activeTab} onTabChange={setTab} />

      <div className="drflow-patient-workspace-panel">
        {activeTab === "resumen" ? <PatientChartView {...chartProps} workspaceMode /> : null}

        {activeTab === "evoluciones" ? (
          <PatientWorkspaceEhrPanel ehr={ehr} patientId={chartProps.patientId} />
        ) : null}

        {activeTab === "diagnosticos" ? (
          <PatientWorkspaceDiagnosticsPanel ehr={ehr} patientId={chartProps.patientId} />
        ) : null}

        {chartFocus ? (
          <PatientWorkspaceChartPanel focus={chartFocus} {...chartProps} />
        ) : null}

        {activeTab === "recetas" ? (
          <PatientWorkspacePrescriptionsPanel
            ehr={ehr}
            patientId={chartProps.patientId}
            canIssue={chartProps.canIssue}
          />
        ) : null}

        {activeTab === "ordenes" ? (
          <PatientWorkspaceOrdersPanel
            ehr={ehr}
            patientId={chartProps.patientId}
            canIssue={chartProps.canIssue}
          />
        ) : null}

        {activeTab === "timeline" ? <PatientWorkspaceTimelinePanel ehr={ehr} /> : null}

        {activeTab === "interconsultas" ? (
          <PatientWorkspacePlaceholderPanel
            tab="interconsultas"
            patientId={chartProps.patientId}
            title="Interconsultas"
            description="Derivaciones y respuestas de otros especialistas, centralizadas en el expediente del paciente."
          />
        ) : null}

        {activeTab === "auditoria" ? (
          <PatientWorkspacePlaceholderPanel
            tab="auditoria"
            patientId={chartProps.patientId}
            title="Auditoría clínica"
            description="Registro de accesos y cambios sobre la historia clínica (Fase 12 del roadmap enterprise)."
          />
        ) : null}

        {activeTab === "ia" ? (
          <PatientWorkspacePlaceholderPanel
            tab="ia"
            patientId={chartProps.patientId}
            title="Asistente IA"
            description="Sugerencias de evolución, CIE-10 e interacciones integradas en el flujo clínico (Fase 7)."
          />
        ) : null}
      </div>
    </div>
  );
}

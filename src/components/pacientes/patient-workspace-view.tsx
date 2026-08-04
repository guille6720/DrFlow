"use client";

import dynamic from "next/dynamic";
import { PatientWorkspaceTabBar } from "@/components/pacientes/patient-workspace-tab-bar";
import { PatientWorkspacePanelSkeleton } from "@/components/pacientes/patient-workspace-panel-skeleton";
import { PatientWorkspaceSheets } from "@/components/pacientes/workspace/patient-workspace-sheets";
import type { PatientWorkspaceViewProps } from "@/components/pacientes/patient-workspace-types";
import {
  PatientWorkspaceChartPanel,
  type PatientChartFocus,
} from "@/components/pacientes/patient-workspace-chart-panel";
import {
  PatientWorkspaceDiagnosticsPanel,
  PatientWorkspaceOrdersPanel,
  PatientWorkspacePrescriptionsPanel,
} from "@/components/pacientes/patient-workspace-ehr-panels";
import type { PatientWorkspaceTabId } from "@/lib/constants/patient-workspace-tabs";
import { usePatientWorkspaceTab } from "@/lib/hooks/use-patient-workspace-tab";
import { PatientWorkflowActionBarHost } from "@/components/clinical-workflow/patient-workflow-action-bar-host";
import { PreVisitBriefPanel } from "@/components/clinical-workflow/pre-visit-brief-panel";
import { ProactiveCarePanel } from "@/components/clinical-workflow/proactive-care-panel";
import { PatientWorkspaceCopilotBridge } from "@/components/pacientes/workspace/patient-workspace-copilot-bridge";

const PatientClinicalAuditPanel = dynamic(
  () =>
    import("@/components/pacientes/patient-clinical-audit-panel").then((m) => ({
      default: m.PatientClinicalAuditPanel,
    })),
  { loading: () => <PatientWorkspacePanelSkeleton /> }
);

const PatientChartView = dynamic(
  () =>
    import("@/components/pacientes/patient-chart-view").then((m) => ({
      default: m.PatientChartView,
    })),
  { loading: () => <PatientWorkspacePanelSkeleton /> }
);

const PatientWorkspaceEhrPanel = dynamic(
  () =>
    import("@/components/pacientes/patient-workspace-ehr-panels").then((m) => ({
      default: m.PatientWorkspaceEhrPanel,
    })),
  { loading: () => <PatientWorkspacePanelSkeleton /> }
);

const PatientWorkspaceTimelinePanel = dynamic(
  () =>
    import("@/components/pacientes/patient-workspace-ehr-panels").then((m) => ({
      default: m.PatientWorkspaceTimelinePanel,
    })),
  { loading: () => <PatientWorkspacePanelSkeleton /> }
);

const CHART_FOCUS_TABS: Partial<Record<PatientWorkspaceTabId, PatientChartFocus>> = {
  problemas: "problemas",
  medicacion: "medicacion",
  alergias: "alergias",
  estudios: "estudios",
  archivos: "archivos",
  vacunas: "vacunas",
};

export function PatientWorkspaceView(props: PatientWorkspaceViewProps) {
  const { ehr, initialTab, templates, patientRecord, ...chartProps } = props;
  const { activeTab, setTab } = usePatientWorkspaceTab(chartProps.patientId, initialTab);

  const chartFocus = CHART_FOCUS_TABS[activeTab];
  const patientName = `${chartProps.patient.first_name} ${chartProps.patient.last_name}`.trim();

  return (
    <div className="drflow-patient-workspace">
      <PatientWorkflowActionBarHost
        patientId={chartProps.patientId}
        canEditClinical={chartProps.canEditClinical}
        canIssue={chartProps.canIssue}
      />
      <PreVisitBriefPanel
        patientName={patientName}
        chart={chartProps.chart}
        lastConsultAt={ehr.consultations[0]?.created_at ?? null}
        className="mb-3"
      />
      <ProactiveCarePanel
        patientId={chartProps.patientId}
        chart={chartProps.chart}
        lastConsultAt={ehr.consultations[0]?.created_at ?? null}
        className="mb-3"
      />
      <PatientWorkspaceCopilotBridge
        activeTab={activeTab}
        patient={chartProps.patient}
        patientId={chartProps.patientId}
        patientName={patientName}
        chart={chartProps.chart}
        ehr={ehr}
        patientRecord={patientRecord}
        lastMedications={chartProps.lastMedications}
      />
      <PatientWorkspaceTabBar activeTab={activeTab} onTabChange={setTab} />

      <div className="drflow-patient-workspace-panel">
        {activeTab === "resumen" ? (
          <PatientChartView
            {...chartProps}
            workspaceMode
            lastEvolution={ehr.consultations[0]?.evolution}
            lastDiagnosis={ehr.diagnosisRows[0]?.name}
          />
        ) : null}

        {activeTab === "soap" ? (
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

        {activeTab === "auditoria" ? (
          <PatientClinicalAuditPanel patientId={chartProps.patientId} />
        ) : null}
      </div>

      <PatientWorkspaceSheets
        activeTab={activeTab}
        patient={chartProps.patient}
        patientId={chartProps.patientId}
        patientRecord={patientRecord}
        ehr={ehr}
        professionals={chartProps.professionals}
        lastMedications={chartProps.lastMedications}
        templates={templates}
        canIssue={chartProps.canIssue}
        chart={chartProps.chart}
      />
    </div>
  );
}

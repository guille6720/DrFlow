"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { PatientWorkflowActionBarHost } from "@/features/ia/components/clinical-workflow/patient-workflow-action-bar-host";
import { PatientWorkspacePanelSkeleton } from "@/features/pacientes/components/pacientes/patient-workspace-panel-skeleton";
import { PatientWorkspaceTabBar } from "@/features/pacientes/components/pacientes/patient-workspace-tab-bar";
import type { PatientWorkspaceViewProps } from "@/features/pacientes/components/pacientes/patient-workspace-types";
import { usePatientWorkspaceTab } from "@/features/pacientes/hooks/use-patient-workspace-tab";
import {
  chartFocusForTab,
  CLINICAL_CONTEXT_TABS,
  shouldLoadCopilotBridge,
  shouldLoadWorkspaceSheets,
} from "@/features/pacientes/utils/patient-workspace-tab-routing";

const PatientClinicalAuditPanel = dynamic(
  () =>
    import("@/features/pacientes/components/pacientes/patient-clinical-audit-panel").then((m) => ({
      default: m.PatientClinicalAuditPanel,
    })),
  { loading: () => <PatientWorkspacePanelSkeleton /> }
);

const PreVisitBriefPanel = dynamic(
  () =>
    import("@/features/ia/components/clinical-workflow/pre-visit-brief-panel").then((m) => ({
      default: m.PreVisitBriefPanel,
    })),
  { loading: () => null }
);

const ProactiveCareAccessButton = dynamic(
  () =>
    import("@/features/ia/components/clinical-workflow/proactive-care-access-button").then((m) => ({
      default: m.ProactiveCareAccessButton,
    })),
  { loading: () => null }
);

const PatientWorkspaceCopilotBridge = dynamic(
  () =>
    import("@/features/pacientes/components/pacientes/workspace/patient-workspace-copilot-bridge").then(
      (m) => ({ default: m.PatientWorkspaceCopilotBridge })
    ),
  { loading: () => null }
);

const PatientWorkspaceSheets = dynamic(
  () =>
    import("@/features/pacientes/components/pacientes/workspace/patient-workspace-sheets").then(
      (m) => ({ default: m.PatientWorkspaceSheets })
    ),
  { loading: () => null }
);

type Props = PatientWorkspaceViewProps & {
  resumenPanel?: ReactNode;
  soapPanel?: ReactNode;
  diagnosticosPanel?: ReactNode;
  recetasPanel?: ReactNode;
  ordenesPanel?: ReactNode;
  docsAdminPanel?: ReactNode;
  timelinePanel?: ReactNode;
  chartPanel?: ReactNode;
  canManageAdminDocuments?: boolean;
};

export function PatientWorkspaceView(props: Props) {
  const {
    ehr,
    initialTab,
    templates,
    patientRecord,
    resumenPanel,
    soapPanel,
    diagnosticosPanel,
    recetasPanel,
    ordenesPanel,
    docsAdminPanel,
    timelinePanel,
    chartPanel,
    canManageAdminDocuments = false,
    ...chartProps
  } = props;
  const searchParams = useSearchParams();
  const { activeTab, setTab } = usePatientWorkspaceTab(chartProps.patientId, initialTab);

  const chartFocus = chartFocusForTab(activeTab);
  const patientName = `${chartProps.patient.first_name} ${chartProps.patient.last_name}`.trim();
  const showClinicalContext = CLINICAL_CONTEXT_TABS.has(activeTab);
  const showCopilotBridge = shouldLoadCopilotBridge(activeTab, searchParams.get("action"));
  const showWorkspaceSheets = shouldLoadWorkspaceSheets(activeTab, searchParams);
  const lastConsultAt = ehr.consultations[0]?.created_at ?? null;

  return (
    <div className="drflow-patient-workspace">
      <PatientWorkflowActionBarHost
        patientId={chartProps.patientId}
        canEditClinical={chartProps.canEditClinical}
        canIssue={chartProps.canIssue}
      />
      {showClinicalContext ? (
        <PreVisitBriefPanel
          patientName={patientName}
          chart={chartProps.chart}
          lastConsultAt={lastConsultAt}
          className="mb-3"
        />
      ) : null}
      {showCopilotBridge ? (
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
      ) : null}
      <div className="drflow-patient-workspace-tabs-row flex items-center gap-2">
        <PatientWorkspaceTabBar
          activeTab={activeTab}
          onTabChange={setTab}
          canManageAdminDocuments={canManageAdminDocuments}
          className="min-w-0 flex-1"
        />
        {showClinicalContext ? (
          <ProactiveCareAccessButton
            patientId={chartProps.patientId}
            chart={chartProps.chart}
            lastConsultAt={lastConsultAt}
          />
        ) : null}
      </div>

      <div className="drflow-patient-workspace-panel">
        {activeTab === "resumen" ? resumenPanel : null}
        {activeTab === "soap" ? soapPanel : null}
        {activeTab === "diagnosticos" ? diagnosticosPanel : null}
        {chartFocus ? chartPanel : null}
        {activeTab === "recetas" ? recetasPanel : null}
        {activeTab === "ordenes" ? ordenesPanel : null}
        {activeTab === "docs_admin" ? docsAdminPanel : null}
        {activeTab === "timeline" ? timelinePanel : null}
        {activeTab === "auditoria" ? (
          <PatientClinicalAuditPanel patientId={chartProps.patientId} />
        ) : null}
      </div>

      {showWorkspaceSheets ? (
        <PatientWorkspaceSheets
          activeTab={activeTab}
          patient={chartProps.patient}
          patientId={chartProps.patientId}
          patientRecord={patientRecord}
          ehr={ehr}
          professionals={chartProps.professionals}
          defaultProfessionalId={chartProps.defaultProfessionalId}
          lastMedications={chartProps.lastMedications}
          templates={templates}
          canIssue={chartProps.canIssue}
          chart={chartProps.chart}
        />
      ) : null}
    </div>
  );
}

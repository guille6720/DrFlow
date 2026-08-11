"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import { PatientWorkflowActionBarHost } from "@/features/ia/components/clinical-workflow/patient-workflow-action-bar-host";
import { PatientWorkspaceTabBar } from "@/features/pacientes/components/pacientes/patient-workspace-tab-bar";
import type { PatientWorkspaceViewProps } from "@/features/pacientes/components/pacientes/patient-workspace-types";
import type { PatientWorkspaceTabId } from "@/features/pacientes/constants/patient-workspace-tabs";
import type { PatientWorkspaceUrlOptions } from "@/features/pacientes/utils/patient-workspace-actions";
import {
  CLINICAL_CONTEXT_TABS,
  shouldLoadCopilotBridge,
  shouldLoadWorkspaceSheets,
} from "@/features/pacientes/utils/patient-workspace-tab-routing";

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
  activeTab: PatientWorkspaceTabId;
  onTabChange: (tab: PatientWorkspaceTabId) => void;
  onOpenHcWorkspace?: () => void;
  navigateWorkspace: (opts: PatientWorkspaceUrlOptions) => void;
  workspaceSearchParams: URLSearchParams;
  activePanel: ReactNode;
  canManageAdminDocuments?: boolean;
};

export function PatientWorkspaceView(props: Props) {
  const {
    ehr,
    activeTab,
    onTabChange,
    onOpenHcWorkspace,
    navigateWorkspace,
    workspaceSearchParams,
    activePanel,
    templates,
    patientRecord,
    canManageAdminDocuments = false,
    coverageRuleOverrides = {},
    ...chartProps
  } = props;

  const patientName = `${chartProps.patient.first_name} ${chartProps.patient.last_name}`.trim();
  const showClinicalContext = CLINICAL_CONTEXT_TABS.has(activeTab);
  const showCopilotBridge = shouldLoadCopilotBridge(activeTab, workspaceSearchParams.get("action"));
  const showWorkspaceSheets = shouldLoadWorkspaceSheets(activeTab, workspaceSearchParams);
  const workspaceNavigation = { workspaceSearchParams, navigateWorkspace };
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
          workspaceNavigation={workspaceNavigation}
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
          patientId={chartProps.patientId}
          activeTab={activeTab}
          workspaceSearchParams={workspaceSearchParams}
          onTabChange={onTabChange}
          onOpenHcWorkspace={onOpenHcWorkspace}
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

      <div className="drflow-patient-workspace-panel">{activePanel}</div>

      {showWorkspaceSheets ? (
        <PatientWorkspaceSheets
          activeTab={activeTab}
          workspaceNavigation={workspaceNavigation}
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
          coverageRuleOverrides={coverageRuleOverrides}
        />
      ) : null}
    </div>
  );
}

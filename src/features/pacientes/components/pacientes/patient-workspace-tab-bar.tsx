"use client";

import { History } from "lucide-react";
import Link from "next/link";

import { cn } from "@/shared/utils/cn";

import {
  DEFAULT_HC_WORKSPACE_TAB,
  isHcPrimaryTabActive,
  isHcWorkspaceTab,
  PATIENT_HC_SUB_TABS,
  PATIENT_WORKSPACE_PRIMARY_TABS,
  type PatientWorkspacePrimaryTabId,
  type PatientWorkspaceTabId,
} from "@/features/pacientes/constants/patient-workspace-tabs";
import { buildPatientWorkspaceUrl } from "@/features/pacientes/utils/patient-workspace-actions";
import { useFeatureFlag } from "@/features/plugins/components/plugins/clinic-features-provider";

type Props = {
  patientId: string;
  activeTab: PatientWorkspaceTabId;
  workspaceSearchParams: URLSearchParams;
  onTabChange: (tab: PatientWorkspaceTabId) => void;
  canManageAdminDocuments?: boolean;
  className?: string;
};

export function PatientWorkspaceTabBar({
  patientId,
  activeTab,
  workspaceSearchParams,
  onTabChange,
  canManageAdminDocuments = false,
  className,
}: Props) {
  const timelineEnabled = useFeatureFlag("clinical_timeline");
  const auditEnabled = useFeatureFlag("patient_audit_tab");
  const priorHistoriesActive =
    activeTab === "soap" && workspaceSearchParams.get("action") !== "nueva";

  const hcSubTabs = PATIENT_HC_SUB_TABS.filter((tab) => {
    if (tab.id === "docs_admin") return canManageAdminDocuments;
    return true;
  });

  const primaryTabs = PATIENT_WORKSPACE_PRIMARY_TABS.filter((tab) => {
    if (tab.id === "timeline") return timelineEnabled;
    if (tab.id === "auditoria") return auditEnabled;
    return true;
  });

  const showHcSubTabs = isHcWorkspaceTab(activeTab);

  function onPrimaryTabClick(id: PatientWorkspacePrimaryTabId) {
    if (id === "hc") {
      onTabChange(isHcWorkspaceTab(activeTab) ? activeTab : DEFAULT_HC_WORKSPACE_TAB);
      return;
    }
    onTabChange(id);
  }

  return (
    <div className={cn("min-w-0 flex-1 space-y-2", className)}>
      <nav className="drflow-patient-workspace-tabs" aria-label="Secciones del paciente">
        <div className="drflow-patient-workspace-tabs-scroll">
          {primaryTabs.map(({ id, label, icon: Icon, ready }) => {
            const isActive = id === "hc" ? isHcPrimaryTabActive(activeTab) : activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onPrimaryTabClick(id)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "drflow-patient-workspace-tab",
                  isActive && "drflow-patient-workspace-tab-active",
                  !ready && "drflow-patient-workspace-tab-soon"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {showHcSubTabs ? (
        <nav className="drflow-patient-workspace-hc-subtabs" aria-label="Historia clínica">
          <div className="drflow-patient-workspace-tabs-scroll">
            {hcSubTabs.map(({ id, label, icon: Icon, ready }) => (
              <button
                key={id}
                type="button"
                onClick={() => onTabChange(id)}
                aria-current={activeTab === id && !priorHistoriesActive ? "page" : undefined}
                className={cn(
                  "drflow-patient-workspace-tab drflow-patient-workspace-hc-subtab",
                  activeTab === id && !priorHistoriesActive && "drflow-patient-workspace-tab-active",
                  !ready && "drflow-patient-workspace-tab-soon"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{label}</span>
              </button>
            ))}
            <Link
              href={buildPatientWorkspaceUrl(patientId, { tab: "soap" })}
              scroll={false}
              aria-current={priorHistoriesActive ? "page" : undefined}
              className={cn(
                "drflow-patient-workspace-tab drflow-patient-workspace-hc-subtab",
                priorHistoriesActive && "drflow-patient-workspace-tab-active"
              )}
            >
              <History className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>Historias Anteriores</span>
            </Link>
          </div>
        </nav>
      ) : null}
    </div>
  );
}

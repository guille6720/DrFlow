"use client";

import { cn } from "@/shared/utils/cn";

import { PATIENT_WORKSPACE_TABS, type PatientWorkspaceTabId } from "@/features/pacientes/constants/patient-workspace-tabs";
import { useFeatureFlag } from "@/features/plugins/components/plugins/clinic-features-provider";

type Props = {
  activeTab: PatientWorkspaceTabId;
  onTabChange: (tab: PatientWorkspaceTabId) => void;
  className?: string;
};

export function PatientWorkspaceTabBar({ activeTab, onTabChange, className }: Props) {
  const timelineEnabled = useFeatureFlag("clinical_timeline");
  const auditEnabled = useFeatureFlag("patient_audit_tab");

  const tabs = PATIENT_WORKSPACE_TABS.filter((tab) => {
    if (tab.id === "timeline") return timelineEnabled;
    if (tab.id === "auditoria") return auditEnabled;
    return true;
  });

  return (
    <nav
      className={cn("drflow-patient-workspace-tabs", className)}
      aria-label="Secciones de historia clínica"
    >
      <div className="drflow-patient-workspace-tabs-scroll">
        {tabs.map(({ id, label, icon: Icon, ready }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            aria-current={activeTab === id ? "page" : undefined}
            className={cn(
              "drflow-patient-workspace-tab",
              activeTab === id && "drflow-patient-workspace-tab-active",
              !ready && "drflow-patient-workspace-tab-soon"
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

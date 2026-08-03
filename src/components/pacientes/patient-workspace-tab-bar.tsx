"use client";

import { PATIENT_WORKSPACE_TABS, type PatientWorkspaceTabId } from "@/lib/constants/patient-workspace-tabs";
import { usePluginEnabled } from "@/components/plugins/clinic-plugins-provider";
import { cn } from "@/lib/utils/cn";

type Props = {
  activeTab: PatientWorkspaceTabId;
  onTabChange: (tab: PatientWorkspaceTabId) => void;
};

export function PatientWorkspaceTabBar({ activeTab, onTabChange }: Props) {
  const iaEnabled = usePluginEnabled("ia");

  const tabs = PATIENT_WORKSPACE_TABS.filter((tab) => {
    if (tab.id === "ia") return iaEnabled;
    return true;
  });

  return (
    <nav
      className="drflow-patient-workspace-tabs"
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

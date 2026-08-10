"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  LEGACY_TAB_ALIASES,
  parsePatientWorkspaceTab,
  patientWorkspacePath,
  type PatientWorkspaceTabId,
} from "@/features/pacientes/constants/patient-workspace-tabs";

type TabSearchParams = {
  get(name: string): string | null;
};

function resolveTabFromLocation(
  initialTab: PatientWorkspaceTabId | undefined,
  searchParams: TabSearchParams
): PatientWorkspaceTabId {
  const rawTab = searchParams.get("tab") ?? initialTab ?? null;
  return parsePatientWorkspaceTab(rawTab ? (LEGACY_TAB_ALIASES[rawTab] ?? rawTab) : null);
}

/** Client tab state synced to the URL without triggering a full RSC reload. */
export function usePatientWorkspaceTab(patientId: string, initialTab?: PatientWorkspaceTabId) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTabState] = useState<PatientWorkspaceTabId>(() =>
    resolveTabFromLocation(initialTab, searchParams)
  );

  useEffect(() => {
    const onPopState = () => {
      setActiveTabState(
        resolveTabFromLocation(initialTab, new URLSearchParams(window.location.search))
      );
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [initialTab]);

  const setTab = useCallback(
    (tab: PatientWorkspaceTabId) => {
      setActiveTabState(tab);
      const url = patientWorkspacePath(patientId, tab);
      window.history.replaceState(window.history.state, "", url);
    },
    [patientId]
  );

  return { activeTab, setTab };
}

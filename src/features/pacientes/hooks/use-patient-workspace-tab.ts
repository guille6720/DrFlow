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

function readLocationSearchParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function resolveTabFromLocation(
  initialTab: PatientWorkspaceTabId | undefined,
  searchParams: TabSearchParams
): PatientWorkspaceTabId {
  const rawTab = searchParams.get("tab") ?? initialTab ?? null;
  return parsePatientWorkspaceTab(rawTab ? (LEGACY_TAB_ALIASES[rawTab] ?? rawTab) : null);
}

function searchParamsFromPatientUrl(url: string): URLSearchParams {
  const query = url.includes("?") ? url.split("?")[1] : "";
  return new URLSearchParams(query);
}

/** Client tab + query state synced to the URL without triggering a full RSC reload. */
export function usePatientWorkspaceTab(patientId: string, initialTab?: PatientWorkspaceTabId) {
  const nextSearchParams = useSearchParams();
  const [activeTab, setActiveTabState] = useState<PatientWorkspaceTabId>(() =>
    resolveTabFromLocation(initialTab, nextSearchParams)
  );
  const [workspaceSearchParams, setWorkspaceSearchParams] = useState<URLSearchParams>(() =>
    typeof window === "undefined" ? new URLSearchParams(nextSearchParams.toString()) : readLocationSearchParams()
  );

  useEffect(() => {
    const onPopState = () => {
      const params = readLocationSearchParams();
      setWorkspaceSearchParams(params);
      setActiveTabState(resolveTabFromLocation(initialTab, params));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [initialTab]);

  const setTab = useCallback(
    (tab: PatientWorkspaceTabId) => {
      const url = patientWorkspacePath(patientId, tab);
      setActiveTabState(tab);
      setWorkspaceSearchParams(searchParamsFromPatientUrl(url));
      window.history.replaceState(window.history.state, "", url);
    },
    [patientId]
  );

  return { activeTab, setTab, workspaceSearchParams };
}

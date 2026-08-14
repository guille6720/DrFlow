"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  LEGACY_TAB_ALIASES,
  parsePatientWorkspaceTab,
  type PatientWorkspaceTabId,
} from "@/features/pacientes/constants/patient-workspace-tabs";
import {
  buildPatientWorkspaceUrl,
  type PatientWorkspaceUrlOptions,
} from "@/features/pacientes/utils/patient-workspace-actions";

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
  const searchParamsKey = nextSearchParams.toString();
  const [manualOverride, setManualOverride] = useState<URLSearchParams | null>(null);

  const workspaceSearchParams = useMemo(
    () => manualOverride ?? new URLSearchParams(searchParamsKey),
    [manualOverride, searchParamsKey]
  );

  const activeTab = useMemo(
    () => resolveTabFromLocation(initialTab, workspaceSearchParams),
    [initialTab, workspaceSearchParams]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setManualOverride(null), 0);
    return () => window.clearTimeout(timer);
  }, [searchParamsKey]);

  useEffect(() => {
    const onPopState = () => {
      setManualOverride(readLocationSearchParams());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const applyWorkspaceUrl = useCallback((url: string) => {
    const params = searchParamsFromPatientUrl(url);
    setManualOverride(params);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const navigateWorkspace = useCallback(
    (opts: PatientWorkspaceUrlOptions) => {
      applyWorkspaceUrl(buildPatientWorkspaceUrl(patientId, opts));
    },
    [applyWorkspaceUrl, patientId]
  );

  /** Switch tab without carrying sheet/action query params from the previous tab. */
  const setTab = useCallback(
    (tab: PatientWorkspaceTabId) => {
      navigateWorkspace({ tab });
    },
    [navigateWorkspace]
  );

  const openHcWorkspace = useCallback(() => {
    navigateWorkspace({ tab: "soap" });
  }, [navigateWorkspace]);

  return { activeTab, setTab, openHcWorkspace, navigateWorkspace, workspaceSearchParams };
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import {
  LEGACY_TAB_ALIASES,
  parsePatientWorkspaceTab,
  patientWorkspacePath,
  type PatientWorkspaceTabId,
} from "@/features/pacientes/constants/patient-workspace-tabs";

export function usePatientWorkspaceTab(patientId: string, initialTab?: PatientWorkspaceTabId) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get("tab") ?? initialTab ?? null;
  const activeTab = parsePatientWorkspaceTab(
    rawTab ? (LEGACY_TAB_ALIASES[rawTab] ?? rawTab) : null
  );

  const setTab = useCallback(
    (tab: PatientWorkspaceTabId) => {
      router.push(patientWorkspacePath(patientId, tab), { scroll: false });
    },
    [patientId, router]
  );

  return { activeTab, setTab };
}

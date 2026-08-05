"use client";

import { useEffect, useMemo } from "react";

import type { PatientRecordGroup } from "@/features/historias/components/historias/clinical-records-grouped-list";
import { useClinicalCopilot } from "@/features/ia/components/clinical-workflow/clinical-copilot-context";
import {
  buildHistoriasCopilotContextFromGroup,
  resolveHistoriasCopilotFocusGroup,
} from "@/features/ia/components/clinical-workflow/historias-copilot-utils";

type Props = {
  groups: PatientRecordGroup[];
  singlePatientFromSearch?: string | null;
};

/** Keeps copilot session in sync when Historia clínica focuses on one patient. */
export function HistoriasCopilotSessionBridge({ groups, singlePatientFromSearch }: Props) {
  const { setSession } = useClinicalCopilot();

  const focusGroup = useMemo(
    () => resolveHistoriasCopilotFocusGroup(groups, singlePatientFromSearch),
    [groups, singlePatientFromSearch]
  );

  useEffect(() => {
    if (!focusGroup) {
      setSession({});
      return;
    }

    setSession(buildHistoriasCopilotContextFromGroup(focusGroup));
    return () => setSession({});
  }, [focusGroup, setSession]);

  return null;
}

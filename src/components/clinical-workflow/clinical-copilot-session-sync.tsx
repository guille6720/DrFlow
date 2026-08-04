"use client";

import { useEffect } from "react";
import type { ClinicalCopilotContext } from "@/lib/utils/clinical-copilot";
import { useClinicalCopilot } from "@/components/clinical-workflow/clinical-copilot-context";

type Props = ClinicalCopilotContext;

/** Syncs patient workspace data into the global copilot session. */
export function ClinicalCopilotSessionSync({
  patientId,
  patientName,
  chart,
  lastConsultAt,
  recentConsultations,
  lastPrescriptionLines,
  assistContext,
}: Props) {
  const { setSession } = useClinicalCopilot();

  useEffect(() => {
    setSession({
      patientId,
      patientName,
      chart,
      lastConsultAt,
      recentConsultations,
      lastPrescriptionLines,
      assistContext,
    });
    return () => setSession({});
  }, [
    patientId,
    patientName,
    chart,
    lastConsultAt,
    recentConsultations,
    lastPrescriptionLines,
    assistContext,
    setSession,
  ]);

  return null;
}

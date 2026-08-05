"use client";

import { useEffect } from "react";

import { useClinicalCopilot } from "@/features/ia/components/clinical-workflow/clinical-copilot-context";

import type { ClinicalCopilotContext } from "@/lib/utils/clinical-copilot";

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

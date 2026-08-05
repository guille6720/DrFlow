"use client";

import type { ReactNode } from "react";

import { cn } from "@/shared/utils/cn";

import { usePatientEhrStateContext } from "@/features/historias/components/historias/patient-ehr-state-context";

type Props = {
  children: ReactNode;
  embedded?: boolean;
};

/** Applies print scope to the EHR shell for scoped @media print rules. */
export function PatientEhrShellFrame({ children, embedded }: Props) {
  const { printScope } = usePatientEhrStateContext();

  return (
    <div
      className={cn(
        embedded
          ? "drflow-ehr-shell drflow-ehr-embedded print:bg-white"
          : "drflow-ehr-shell min-h-[calc(100vh-10rem)] print:bg-white"
      )}
      data-print-scope={printScope ?? undefined}
    >
      {children}
    </div>
  );
}

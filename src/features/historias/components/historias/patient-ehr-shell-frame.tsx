"use client";

import type { ReactNode } from "react";

import { cn } from "@/shared/utils/cn";

type Props = {
  children: ReactNode;
  embedded?: boolean;
};

export function PatientEhrShellFrame({ children, embedded }: Props) {
  return (
    <div
      className={cn(
        "drflow-ehr-shell flex min-h-0 flex-1 flex-col print:bg-white",
        embedded && "drflow-ehr-embedded"
      )}
    >
      {children}
    </div>
  );
}

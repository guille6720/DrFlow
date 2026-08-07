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
        embedded
          ? "drflow-ehr-shell drflow-ehr-embedded print:bg-white"
          : "drflow-ehr-shell min-h-[calc(100vh-10rem)] print:bg-white"
      )}
    >
      {children}
    </div>
  );
}

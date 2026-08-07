import type { ReactNode } from "react";

import { cn } from "@/shared/utils/cn";

type Tone = "success" | "error" | "info";

type Props = {
  tone: Tone;
  children: ReactNode;
  className?: string;
  /** Errors use role="alert" (assertive); success/info use role="status" (polite). */
  live?: "polite" | "assertive";
};

const toneClass: Record<Tone, string> = {
  success: "text-emerald-700",
  error: "text-red-600",
  info: "text-slate-600",
};

/** Announces form/status feedback to screen readers without changing visual design. */
export function LiveStatusMessage({ tone, children, className, live }: Props) {
  const isError = tone === "error";
  return (
    <p
      role={isError ? "alert" : "status"}
      aria-live={live ?? (isError ? "assertive" : "polite")}
      aria-atomic="true"
      className={cn("text-sm", toneClass[tone], className)}
    >
      {children}
    </p>
  );
}

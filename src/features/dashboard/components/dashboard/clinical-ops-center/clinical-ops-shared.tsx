"use client";

import { cn } from "@/shared/utils/cn";
import type { ClinicalOpsWaitingPriority } from "@/features/dashboard/utils/clinical-operations-types";

export function patientInitials(firstName?: string, lastName?: string): string {
  const f = firstName?.trim().charAt(0) ?? "";
  const l = lastName?.trim().charAt(0) ?? "";
  return (f + l).toUpperCase() || "?";
}

export function PatientAvatar({
  firstName,
  lastName,
  priority,
  className,
}: {
  firstName?: string;
  lastName?: string;
  priority?: ClinicalOpsWaitingPriority;
  className?: string;
}) {
  const ring =
    priority === "urgent"
      ? "ring-2 ring-red-500"
      : priority === "high"
        ? "ring-2 ring-amber-400"
        : "ring-1 ring-slate-600";

  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold text-teal-200",
        ring,
        className
      )}
      aria-hidden
    >
      {patientInitials(firstName, lastName)}
    </div>
  );
}

export function OpsSection({
  id,
  title,
  count,
  action,
  children,
  className,
}: {
  id?: string;
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className={cn(
        "rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 shadow-sm",
        className
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2
          id={id ? `${id}-title` : undefined}
          className="text-sm font-semibold uppercase tracking-wide text-slate-200"
        >
          {title}
          {count != null ? (
            <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs font-bold text-teal-300">
              {count}
            </span>
          ) : null}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PriorityBadge({ priority }: { priority: ClinicalOpsWaitingPriority }) {
  const styles: Record<ClinicalOpsWaitingPriority, string> = {
    urgent: "bg-red-950/80 text-red-200 border-red-700",
    high: "bg-amber-950/80 text-amber-200 border-amber-700",
    normal: "bg-slate-800 text-slate-300 border-slate-600",
  };
  const labels: Record<ClinicalOpsWaitingPriority, string> = {
    urgent: "Urgente",
    high: "Alta",
    normal: "Normal",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase",
        styles[priority]
      )}
    >
      {labels[priority]}
    </span>
  );
}

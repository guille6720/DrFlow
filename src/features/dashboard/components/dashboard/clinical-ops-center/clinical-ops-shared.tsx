import type { ReactNode } from "react";

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
        : "ring-1 ring-[var(--border-default,#e2e8f0)]";

  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-selected,#ccfbf1)] text-sm font-semibold text-[var(--sidebar-accent,#0f766e)]",
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
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className={cn(
        "drflow-card-light scroll-mt-24 rounded-xl border border-[var(--border-default,#e2e8f0)] bg-[var(--surface-card,#fff)] p-4 shadow-sm",
        className
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2
          id={id ? `${id}-title` : undefined}
          className="text-sm font-bold uppercase tracking-wide text-[var(--text-primary,#172033)]"
        >
          {title}
          {count != null ? (
            <span className="ml-2 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-[var(--surface-hover,#f1f5f9)] px-2 py-0.5 text-xs font-bold text-[var(--text-primary,#172033)] ring-1 ring-[var(--border-default,#e2e8f0)]">
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

export function PriorityBadge({ priority }: { priority?: ClinicalOpsWaitingPriority | null }) {
  const tone: ClinicalOpsWaitingPriority =
    priority === "urgent" || priority === "high" ? priority : "normal";
  const styles: Record<ClinicalOpsWaitingPriority, string> = {
    urgent: "bg-red-50 text-red-700 border-red-200",
    high: "bg-amber-50 text-amber-800 border-amber-200",
    normal: "bg-[var(--surface-hover,#f1f5f9)] text-[var(--text-secondary,#475569)] border-[var(--border-default,#e2e8f0)]",
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
        styles[tone]
      )}
    >
      {labels[tone]}
    </span>
  );
}

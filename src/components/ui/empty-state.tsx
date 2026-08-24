import type { LucideIcon } from "lucide-react";

import { cn } from "@/shared/utils/cn";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "drflow-empty-state flex flex-col items-center justify-center rounded-[10px] border border-dashed border-[var(--border-default,var(--border))] bg-[var(--surface-elevated,var(--surface,var(--muted)))]/50 px-6 py-12 text-center",
        className
      )}
    >
      <div className="mb-4 rounded-full bg-[var(--accent-soft)] p-4">
        <Icon className="h-8 w-8 text-[var(--primary)]" />
      </div>
      <h3 className="text-lg font-semibold text-[var(--text-primary,var(--foreground))]">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-[var(--text-secondary,var(--muted-foreground))]">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

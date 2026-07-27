import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  action?: ReactNode;
}

export function Card({ children, className, title, description, action }: CardProps) {
  return (
    <div className={cn("min-w-0 overflow-visible rounded-2xl border border-slate-200/90 bg-white shadow-md shadow-slate-200/40", className)}>
      {(title || action) && (
        <div className="flex min-w-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0 flex-1">
            {title && <h3 className="break-words font-semibold text-slate-900">{title}</h3>}
            {description && (
              <p className="mt-0.5 break-words text-sm text-slate-500">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="min-w-0 p-5">{children}</div>
    </div>
  );
}

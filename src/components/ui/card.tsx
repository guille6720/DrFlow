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
    <div className={cn("min-w-0 overflow-visible rounded-2xl border border-slate-600/80 bg-slate-800/95 text-slate-100 shadow-lg shadow-black/20", className)}>
      {(title || action) && (
        <div className="flex min-w-0 items-start justify-between gap-3 border-b border-slate-700/80 px-5 py-4">
          <div className="min-w-0 flex-1">
            {title && <h3 className="break-words font-semibold text-slate-50">{title}</h3>}
            {description && (
              <p className="mt-0.5 break-words text-sm text-slate-300">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="min-w-0 p-5 [&>*]:text-slate-900">{children}</div>
    </div>
  );
}

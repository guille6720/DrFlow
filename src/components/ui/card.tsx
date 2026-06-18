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
    <div className={cn("rounded-2xl border border-teal-100/80 bg-white shadow-sm", className)}>
      {(title || action) && (
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h3 className="font-semibold text-slate-900">{title}</h3>}
            {description && (
              <p className="mt-0.5 text-sm text-slate-500">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

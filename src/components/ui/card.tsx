import type { ReactNode } from "react";

import { cn } from "@/shared/utils/cn";

interface CardProps {
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  title?: string;
  description?: string;
  action?: ReactNode;
}

export function Card({ children, className, bodyClassName, title, description, action }: CardProps) {
  return (
    <div className={cn("drflow-ui-card min-w-0 overflow-visible", className)}>
      {(title || action) && (
        <div className="drflow-ui-card-header flex min-w-0 items-start justify-between gap-3 px-5 py-4">
          <div className="min-w-0 flex-1">
            {title && <h3 className="drflow-ui-card-title break-words font-semibold">{title}</h3>}
            {description && (
              <p className="drflow-ui-card-desc mt-0.5 break-words text-sm">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn("drflow-card-body drflow-ui-card-body min-w-0 p-5", bodyClassName)}>{children}</div>
    </div>
  );
}

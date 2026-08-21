import type { ReactNode } from "react";

import { cn } from "@/shared/utils/cn";

const variants = {
  default: "bg-slate-100 text-slate-800",
  success: "bg-emerald-100 text-emerald-900",
  warning: "bg-amber-100 text-amber-900",
  danger: "bg-red-100 text-red-900",
  info: "bg-sky-100 text-sky-900",
  brand: "bg-teal-100 text-teal-900",
  /** @deprecated use brand */
  teal: "bg-teal-100 text-teal-900",
};

interface BadgeProps {
  children: ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export const appointmentStatusBadge: Record<
  string,
  { label: string; variant: keyof typeof variants }
> = {
  pending: { label: "Pendiente", variant: "warning" },
  confirmed: { label: "Confirmado", variant: "info" },
  attended: { label: "Atendido", variant: "success" },
  cancelled: { label: "Cancelado", variant: "danger" },
  no_show: { label: "Ausente", variant: "default" },
};

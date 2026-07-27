import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface ListPaginationProps {
  children: ReactNode;
  className?: string;
}

/** Barra de paginación legible sobre fondo oscuro del dashboard. */
export function ListPagination({ children, className }: ListPaginationProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-3 rounded-xl border border-slate-500/70 bg-slate-800/95 px-4 py-3 text-sm shadow-lg shadow-black/25 ring-1 ring-teal-500/20",
        className
      )}
    >
      {children}
    </div>
  );
}

interface ListPaginationLabelProps {
  current: number;
  totalPages: number;
  suffix: string;
}

export function ListPaginationLabel({ current, totalPages, suffix }: ListPaginationLabelProps) {
  return (
    <span className="text-center font-medium text-slate-100">
      Página{" "}
      <span className="text-base font-bold text-teal-300">{current}</span> de{" "}
      <span className="text-base font-bold text-teal-300">{totalPages}</span>
      <span className="text-slate-300"> ({suffix})</span>
    </span>
  );
}

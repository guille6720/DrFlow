"use client";

import { Home } from "lucide-react";
import Link from "next/link";

import { useHasGeriatrics } from "@/core/components/products/products-provider";

import { cn } from "@/shared/utils/cn";

type Props = {
  patientId: string;
  /** Compact style for list rows; default for detail header. */
  compact?: boolean;
  className?: string;
};

/** Visible only when product.geriatrics is enabled for the active clinic. */
export function AddPatientToGeriatricsButton({ patientId, compact = false, className }: Props) {
  const hasGeriatrics = useHasGeriatrics();
  if (!hasGeriatrics) return null;

  return (
    <Link
      href={`/geriatria/residentes/nuevo?patientId=${encodeURIComponent(patientId)}`}
      prefetch
      className={cn(
        compact
          ? "inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200"
          : "inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-900 hover:bg-teal-100 dark:border-teal-700 dark:bg-teal-950/50 dark:text-teal-100",
        className
      )}
    >
      <Home className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      {compact ? "Geriatría" : "Agregar a Geriatría"}
    </Link>
  );
}

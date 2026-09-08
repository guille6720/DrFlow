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
  /**
   * Server-resolved product flag. When true/false, takes precedence over the
   * client snapshot so the list button stays visible after Superadmin enablement.
   */
  geriatricsEnabled?: boolean;
  /** Patient already has an open geriatrics resident record. */
  isResident?: boolean;
  /**
   * On patient ficha: hide entirely once already admitted.
   * On list: keep visible (red) to differentiate.
   */
  hideWhenResident?: boolean;
};

/**
 * Agrega el paciente como residente sin sacarlo de Clínica.
 * Misma identidad (`patient_id`) → conserva historia clínica.
 */
export function AddPatientToGeriatricsButton({
  patientId,
  compact = false,
  className,
  geriatricsEnabled,
  isResident = false,
  hideWhenResident = false,
}: Props) {
  const hasGeriatricsFromContext = useHasGeriatrics();
  const hasGeriatrics =
    typeof geriatricsEnabled === "boolean" ? geriatricsEnabled : hasGeriatricsFromContext;
  if (!hasGeriatrics) return null;
  if (isResident && hideWhenResident) return null;

  if (isResident) {
    return (
      <Link
        href={`/geriatria/residentes`}
        prefetch
        title="Ya es residente. Abrí el módulo Geriatría → Residentes."
        className={cn(
          compact
            ? "inline-flex items-center gap-1.5 rounded-lg border border-red-400 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 dark:border-red-700 dark:bg-red-950/50 dark:text-red-200"
            : "inline-flex items-center gap-1.5 rounded-lg border border-red-400 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 dark:border-red-700 dark:bg-red-950/50 dark:text-red-200",
          className
        )}
      >
        <Home className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        En Geriatría
      </Link>
    );
  }

  return (
    <Link
      href={`/geriatria/residentes/nuevo?patientId=${encodeURIComponent(patientId)}`}
      prefetch
      title="Ingresar como residente sin sacarlo de Clínica. Conserva toda la historia clínica."
      className={cn(
        compact
          ? "inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100"
          : "inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-100",
        className
      )}
    >
      <Home className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      Agregar a Geriatría
    </Link>
  );
}

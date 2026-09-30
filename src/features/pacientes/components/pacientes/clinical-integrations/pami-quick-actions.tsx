"use client";

import { ExternalLink, Landmark } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchPamiLaunchContext } from "@/features/pacientes/components/pacientes/clinical-integrations/integration-context-fetch";

import { buttonSurfaceClassName } from "@/components/ui/button";
import { PAMI_LINK_REL, PAMI_LINK_TARGET } from "@/lib/integrations/pami/config";
import type { PamiLaunchContextResult } from "@/lib/integrations/pami/types";

type Props = {
  patientId: string;
  /** Runs before the new tab opens (e.g. persist an in-progress evolution draft). */
  onBeforeOpen?: () => void;
};

/** Compact "Receta PAMI" / "Orden PAMI / OME" links for the clinical history header. Server-resolved access. */
export function PamiQuickActions({ patientId, onBeforeOpen }: Props) {
  const [ctx, setCtx] = useState<PamiLaunchContextResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPamiLaunchContext(patientId).then((res) => {
      if (!cancelled) setCtx(res);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  if (!ctx?.ok) return null;
  const variant = ctx.patient.pamiCoverage ? "secondary" : "outline";
  const links = [
    ctx.access.prescriptions
      ? {
          href: ctx.prescriptionUrl,
          label: "Receta PAMI",
          aria: "Receta PAMI: abrir el sistema oficial de PAMI (se abre en una nueva pestaña)",
          testId: "ehr-pami-prescription",
        }
      : null,
    ctx.access.medicalOrders
      ? {
          href: ctx.medicalOrderUrl,
          label: "Orden PAMI / OME",
          aria: "Orden médica electrónica PAMI (OME): abrir el sistema oficial de PAMI (se abre en una nueva pestaña)",
          testId: "ehr-pami-medical-order",
        }
      : null,
  ].filter((l): l is NonNullable<typeof l> => l !== null);

  return (
    <>
      {links.map((link) => (
        <a
          key={link.testId}
          href={link.href}
          target={PAMI_LINK_TARGET}
          rel={PAMI_LINK_REL}
          aria-label={link.aria}
          title={link.aria}
          onClick={onBeforeOpen}
          className={buttonSurfaceClassName(variant, "sm", "gap-1.5")}
          data-testid={link.testId}
        >
          <Landmark className="h-4 w-4" aria-hidden />
          {link.label}
          <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden />
        </a>
      ))}
    </>
  );
}

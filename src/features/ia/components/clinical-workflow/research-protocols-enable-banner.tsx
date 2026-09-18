"use client";

import { AlertTriangle, FlaskConical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { CLINICAL_RESEARCH_PRIVACY_LEGAL_REVIEW } from "@/core/compliance/clinical-research-ai";
import { SafeInternalLink } from "@/core/components/safe-link";

import { Button } from "@/components/ui/button";
import { enableClinicalResearchProtocols } from "@/lib/actions/clinic-feature-flags";

type Props = {
  onEnabled?: () => void;
};

export function ResearchProtocolsEnableBanner({ onEnabled }: Props) {
  const router = useRouter();
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [pending, startTransition] = useTransition();

  const requiredItems = CLINICAL_RESEARCH_PRIVACY_LEGAL_REVIEW.filter(
    (item) => item.status === "required_before_activation"
  );

  function handleEnable() {
    setError(null);
    startTransition(async () => {
      const result = await enableClinicalResearchProtocols({
        acknowledgedLegalReview: acknowledged,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setEnabled(true);
      onEnabled?.();
      router.refresh();
    });
  }

  if (enabled) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        Protocolos de investigación activados. Recargá la página o volvé a hacer la búsqueda.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-3 text-sm text-amber-950">
      <div className="flex items-start gap-2">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-medium">Protocolos de investigación desactivados</p>
          <p className="text-xs leading-relaxed text-amber-900/90">
            Para buscar candidatos (ZENITH, EKGB, PRESTO, etc.) activá el flag del consultorio.
            Requiere permiso de administrador y revisión legal/privacidad documentada.
          </p>
          <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-amber-900/85">
            {requiredItems.slice(0, 4).map((item) => (
              <li key={item.id}>{item.label}</li>
            ))}
          </ul>
          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-amber-300"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            <span>
              Confirmo que completé la revisión legal y de privacidad documentada (Fase 18) para
              screening interno de candidatos a ensayos clínicos.
            </span>
          </label>
          {error ? (
            <p className="flex items-start gap-1 text-xs text-red-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending || !acknowledged}
              onClick={handleEnable}
            >
              Activar protocolos de investigación
            </Button>
            <SafeInternalLink
              href="/configuracion?grupo=sistema&seccion=flags"
              className="inline-flex items-center text-xs font-medium text-amber-900 underline underline-offset-2"
            >
              O activar en Configuración → Feature flags
            </SafeInternalLink>
          </div>
        </div>
      </div>
    </div>
  );
}

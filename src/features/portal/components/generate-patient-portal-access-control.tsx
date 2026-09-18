"use client";

import { Copy, Link2, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import { toast } from "@/core/notifications/toast";

import { cn } from "@/shared/utils/cn";

import { createPatientPortalAccessLink } from "@/features/portal/actions/create-patient-portal-access";

import { Button } from "@/components/ui/button";

interface Props {
  patientId: string;
  compact?: boolean;
  className?: string;
}

/** Staff: generate a 30-minute secure patient portal magic link. */
export function GeneratePatientPortalAccessControl({
  patientId,
  compact = false,
  className,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [accessUrl, setAccessUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expiresMinutes, setExpiresMinutes] = useState(30);

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await createPatientPortalAccessLink({ patientId });
      if (result.error || !result.accessUrl) {
        setError(result.error ?? "No pudimos generar el enlace.");
        setAccessUrl(null);
        return;
      }
      setAccessUrl(result.accessUrl);
      setExpiresMinutes(result.expiresMinutes ?? 30);
    });
  }

  async function handleCopy() {
    if (!accessUrl) return;
    try {
      await navigator.clipboard.writeText(accessUrl);
      toast.copySuccess("Enlace seguro copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  }

  if (compact) {
    return (
      <div className={cn("inline-flex flex-col items-start gap-1", className)}>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={pending}
          className="inline-flex items-center gap-1 text-xs font-medium text-teal-800 hover:underline disabled:opacity-50"
          title="Generar acceso al Portal"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
          {pending ? "Generando…" : "Generar acceso al Portal"}
        </button>
        {accessUrl ? (
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex items-center gap-1 text-xs text-slate-600 hover:underline"
          >
            <Copy className="h-3 w-3" />
            Copiar enlace (vence en {expiresMinutes} min)
          </button>
        ) : null}
        {error ? <span className="text-xs text-amber-700">{error}</span> : null}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-sm text-slate-600">
        Generá un enlace seguro para que el paciente vea y cancele sus turnos. No uses el DNI como
        autenticación.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={handleGenerate} disabled={pending}>
          <Link2 className="h-4 w-4" />
          {pending ? "Generando…" : "Generar acceso al Portal"}
        </Button>
        {accessUrl ? (
          <Button type="button" size="sm" variant="outline" onClick={() => void handleCopy()}>
            <Copy className="h-4 w-4" />
            Copiar enlace
          </Button>
        ) : null}
      </div>
      {accessUrl ? (
        <p className="text-sm font-medium text-teal-800">Este enlace vence en {expiresMinutes} minutos.</p>
      ) : null}
      {error ? <p className="text-sm text-amber-800">{error}</p> : null}
    </div>
  );
}

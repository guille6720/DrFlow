"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { toast } from "@/core/notifications/toast";

import { Button } from "@/components/ui/button";
import { cancelClinicSubscriptionAction } from "@/lib/actions/billing";

type Props = {
  periodEndLabel?: string | null;
  alreadyCanceled?: boolean;
};

/**
 * Single-confirm cancel — no survey, phone gate, or multi-step retention.
 */
export function CancelSubscriptionButton({ periodEndLabel, alreadyCanceled = false }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (alreadyCanceled) {
    return (
      <p className="text-sm text-slate-600">
        Suscripción cancelada.
        {periodEndLabel ? (
          <>
            {" "}
            Conservás el acceso hasta <strong>{periodEndLabel}</strong>.
          </>
        ) : null}
      </p>
    );
  }

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelClinicSubscriptionAction();
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        setConfirming(false);
        return;
      }
      toast.success(
        result.alreadyCanceled
          ? "La suscripción ya estaba cancelada."
          : periodEndLabel
            ? `Cancelación registrada. Acceso hasta ${periodEndLabel}.`
            : "Cancelación registrada."
      );
      setConfirming(false);
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <div className="space-y-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => setConfirming(true)}
        >
          Cancelar suscripción
        </Button>
        <p className="text-xs text-slate-500">
          Sin cargos posteriores en NexClinic. Si ya pagaste el período, el acceso continúa hasta el
          vencimiento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm text-slate-800">
        ¿Confirmás la cancelación?
        {periodEndLabel ? (
          <>
            {" "}
            Vas a conservar el acceso hasta <strong>{periodEndLabel}</strong>.
          </>
        ) : null}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={pending}
          onClick={handleCancel}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {pending ? "Cancelando…" : "Sí, cancelar"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Volver
        </Button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/** Keeps Superadmin chrome visible and shows the real error (not the generic dashboard crash). */
export default function SuperadminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[superadmin]", error);
  }, [error]);

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50">
      <h1 className="text-lg font-semibold">No pudimos cargar esta pantalla de Superadmin</h1>
      <p className="mt-2 text-sm opacity-90">
        El error quedó contenido acá para que puedas volver al listado de clínicas y reintentar el
        cambio de plan.
      </p>
      {error.message ? (
        <p className="mt-3 break-words font-mono text-xs opacity-80">{error.message}</p>
      ) : null}
      {error.digest ? (
        <p className="mt-1 font-mono text-xs opacity-60">Ref: {error.digest}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={() => reset()}>
          Reintentar
        </Button>
        <Button type="button" variant="outline" onClick={() => window.location.assign("/superadmin/clinics")}>
          Ir a Clínicas
        </Button>
      </div>
    </div>
  );
}

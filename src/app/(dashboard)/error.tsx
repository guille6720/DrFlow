"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold text-slate-900">No pudimos cargar esta pantalla</h1>
      <p className="max-w-md text-sm text-slate-600">
        Puede ser un problema temporal del servidor. Probá de nuevo o volvé al inicio de sesión.
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-slate-400">Ref: {error.digest}</p>
      ) : null}
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={() => reset()}>
          Reintentar
        </Button>
        <Button type="button" variant="outline" onClick={() => window.location.assign("/login")}>
          Ir al login
        </Button>
      </div>
    </div>
  );
}

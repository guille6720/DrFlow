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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-center">
      <h1 className="text-lg font-semibold text-white">No pudimos cargar el panel</h1>
      <p className="max-w-md text-sm text-slate-400">
        Hubo un error al cargar el dashboard. Probá de nuevo o volvé al login.
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-slate-600">Ref: {error.digest}</p>
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

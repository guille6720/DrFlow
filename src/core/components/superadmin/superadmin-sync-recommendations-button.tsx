"use client";

import { useState, useTransition } from "react";

import { syncPlanRecommendationsAction } from "@/lib/actions/superadmin-commercial";

export function SuperadminSyncRecommendationsButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-600"
        onClick={() => {
          startTransition(async () => {
            const result = await syncPlanRecommendationsAction();
            setMessage(
              result.ok
                ? `Sincronizadas: ${result.synced}`
                : result.error
            );
          });
        }}
      >
        Persistir recomendaciones
      </button>
      {message ? <span className="text-xs text-slate-600">{message}</span> : null}
    </div>
  );
}

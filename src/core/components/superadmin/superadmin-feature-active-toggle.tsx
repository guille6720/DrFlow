"use client";

import { useState, useTransition } from "react";

import { setFeatureActiveAction } from "@/lib/actions/superadmin-commercial";

export function SuperadminFeatureActiveToggle({
  featureKey,
  isActive,
}: {
  featureKey: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState(isActive);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium disabled:opacity-50 dark:border-slate-600"
        onClick={() => {
          startTransition(async () => {
            const fd = new FormData();
            fd.set("featureKey", featureKey);
            fd.set("isActive", String(!active));
            const result = await setFeatureActiveAction(fd);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setActive(!active);
            setError(null);
          });
        }}
      >
        {active ? "Desactivar" : "Activar"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}

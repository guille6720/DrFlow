"use client";

import { useState, useTransition } from "react";

import { ADMIN_OVERRIDE_FEATURE_KEYS } from "@/core/entitlements/admin-constants";

import { upsertPlanFeatureAction } from "@/lib/actions/superadmin-commercial";

export function SuperadminPlanFeatureForm({ planKey }: { planKey: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-3 grid gap-2 border-t border-slate-100 pt-3 text-sm dark:border-slate-800 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("planKey", planKey);
        startTransition(async () => {
          const result = await upsertPlanFeatureAction(fd);
          setMessage(result.ok ? "Feature de plan actualizada." : result.error);
        });
      }}
    >
      <p className="sm:col-span-2 text-xs font-medium text-slate-500">Asignar feature / límite</p>
      <select name="featureKey" required className="rounded-md border border-slate-300 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-900">
        {ADMIN_OVERRIDE_FEATURE_KEYS.map((key) => (
          <option key={key} value={key}>
            {key}
          </option>
        ))}
      </select>
      <select name="enabled" defaultValue="true" className="rounded-md border border-slate-300 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-900">
        <option value="true">Enabled</option>
        <option value="false">Disabled</option>
      </select>
      <input
        name="limit"
        type="number"
        placeholder="Límite (opcional)"
        className="rounded-md border border-slate-300 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-900"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-50 dark:border-slate-600"
      >
        Aplicar a plan
      </button>
      {message ? <p className="sm:col-span-2 text-xs text-slate-600">{message}</p> : null}
    </form>
  );
}

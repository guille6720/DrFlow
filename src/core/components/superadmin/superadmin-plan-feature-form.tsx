"use client";

import { useState, useTransition } from "react";

import { ADMIN_OVERRIDE_FEATURE_KEYS } from "@/core/entitlements/admin-constants";

import { upsertPlanFeatureAction } from "@/lib/actions/superadmin-commercial";

const fieldClass =
  "rounded-md border border-[var(--border-default,#e2e8f0)] bg-[var(--surface-input,#fff)] px-2 py-1.5 text-[var(--text-primary,#172033)] placeholder:text-[var(--text-muted,#64748b)]";

export function SuperadminPlanFeatureForm({ planKey }: { planKey: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-3 grid gap-2 border-t border-[var(--border-default,#e2e8f0)] pt-3 text-sm text-[var(--text-primary,#172033)] sm:grid-cols-2"
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
      <p className="sm:col-span-2 text-xs font-medium text-[var(--text-muted,#64748b)]">
        Asignar feature / límite
      </p>
      <select name="featureKey" required className={fieldClass}>
        {ADMIN_OVERRIDE_FEATURE_KEYS.map((key) => (
          <option key={key} value={key}>
            {key}
          </option>
        ))}
      </select>
      <select name="enabled" defaultValue="true" className={fieldClass}>
        <option value="true">Enabled</option>
        <option value="false">Disabled</option>
      </select>
      <input
        name="limit"
        type="number"
        placeholder="Límite (opcional)"
        className={fieldClass}
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-[var(--border-default,#e2e8f0)] bg-[var(--surface-card,#fff)] px-3 py-1.5 text-[var(--text-primary,#172033)] disabled:opacity-50"
      >
        Aplicar a plan
      </button>
      {message ? (
        <p className="sm:col-span-2 text-xs text-[var(--text-secondary,#475569)]">{message}</p>
      ) : null}
    </form>
  );
}

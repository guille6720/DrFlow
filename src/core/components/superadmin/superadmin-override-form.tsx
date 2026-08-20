"use client";

import { useState, useTransition } from "react";

import { ADMIN_OVERRIDE_FEATURE_KEYS } from "@/core/entitlements/admin-constants";

import { createFeatureOverrideAction } from "@/lib/actions/entitlements-admin";

export function SuperadminOverrideForm({ clinicId }: { clinicId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("clinicId", clinicId);
        startTransition(async () => {
          const result = await createFeatureOverrideAction(fd);
          setMessage(result.ok ? "Override guardado." : result.error);
          if (result.ok) e.currentTarget.reset();
        });
      }}
    >
      <select name="featureKey" required className="rounded-md border border-slate-300 px-2 py-2 text-sm">
        {ADMIN_OVERRIDE_FEATURE_KEYS.map((key) => (
          <option key={key} value={key}>
            {key}
          </option>
        ))}
      </select>
      <select name="enabled" defaultValue="true" className="rounded-md border border-slate-300 px-2 py-2 text-sm">
        <option value="true">Enabled</option>
        <option value="false">Disabled</option>
      </select>
      <input
        name="limit"
        type="number"
        placeholder="Límite (opcional)"
        className="rounded-md border border-slate-300 px-2 py-2 text-sm"
      />
      <input
        name="startsAt"
        type="datetime-local"
        placeholder="Desde"
        className="rounded-md border border-slate-300 px-2 py-2 text-sm"
      />
      <input
        name="endsAt"
        type="datetime-local"
        className="rounded-md border border-slate-300 px-2 py-2 text-sm"
      />
      <input
        name="reason"
        required
        placeholder="Motivo"
        className="rounded-md border border-slate-300 px-2 py-2 text-sm sm:col-span-2"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Guardar override
      </button>
      {message ? <p className="sm:col-span-3 text-sm text-slate-700">{message}</p> : null}
    </form>
  );
}

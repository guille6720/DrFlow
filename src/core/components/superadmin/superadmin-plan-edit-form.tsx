"use client";

import { useState, useTransition } from "react";

import { updateCommercialPlanAction } from "@/lib/actions/superadmin-commercial";

export function SuperadminPlanEditForm({
  planKey,
  name,
  description,
  displayOrder,
  isPublic,
  isActive,
  isLegacy,
  isTrial,
}: {
  planKey: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isPublic: boolean;
  isActive: boolean;
  isLegacy: boolean;
  isTrial: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-sm dark:border-slate-800"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("planKey", planKey);
        startTransition(async () => {
          const result = await updateCommercialPlanAction(fd);
          setMessage(result.ok ? "Plan actualizado." : result.error);
        });
      }}
    >
      {isTrial ? (
        <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
          Advertencia: modificar Trial afecta clínicas nuevas.
        </p>
      ) : null}
      <input
        name="name"
        defaultValue={name}
        required
        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-900"
      />
      <textarea
        name="description"
        defaultValue={description ?? ""}
        rows={2}
        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-900"
      />
      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-1">
          Orden
          <input
            name="displayOrder"
            type="number"
            defaultValue={displayOrder}
            className="w-20 rounded-md border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900"
          />
        </label>
        <label className="flex items-center gap-1">
          <input
            name="isPublic"
            type="checkbox"
            defaultChecked={isPublic}
            disabled={isLegacy}
            value="true"
          />
          Público
        </label>
        <label className="flex items-center gap-1">
          <input name="isActive" type="checkbox" defaultChecked={isActive} value="true" />
          Activo
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
      >
        Guardar
      </button>
      {message ? <p className="text-xs text-slate-600 dark:text-slate-300">{message}</p> : null}
    </form>
  );
}

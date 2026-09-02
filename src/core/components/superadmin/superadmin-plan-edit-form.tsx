"use client";

import { useState, useTransition } from "react";

import { updateCommercialPlanAction } from "@/lib/actions/superadmin-commercial";

const fieldClass =
  "w-full rounded-md border border-[var(--border-default,#e2e8f0)] bg-[var(--surface-input,#fff)] px-2 py-1.5 text-[var(--text-primary,#172033)] placeholder:text-[var(--text-muted,#64748b)]";

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
      className="mt-3 space-y-2 border-t border-[var(--border-default,#e2e8f0)] pt-3 text-sm text-[var(--text-primary,#172033)]"
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
        <p className="text-xs font-medium text-amber-800">
          Advertencia: modificar Trial afecta clínicas nuevas.
        </p>
      ) : null}
      <input name="name" defaultValue={name} required className={fieldClass} />
      <textarea
        name="description"
        defaultValue={description ?? ""}
        rows={2}
        className={fieldClass}
      />
      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-1">
          Orden
          <input
            name="displayOrder"
            type="number"
            defaultValue={displayOrder}
            className={`w-20 ${fieldClass}`}
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
        className="rounded-md bg-[var(--text-primary,#172033)] px-3 py-1.5 font-medium text-[var(--surface-card,#fff)] disabled:opacity-50"
      >
        Guardar
      </button>
      {message ? <p className="text-xs text-[var(--text-secondary,#475569)]">{message}</p> : null}
    </form>
  );
}

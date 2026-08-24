"use client";

import { useState, useTransition } from "react";

import { setRecommendationStatusAction } from "@/lib/actions/superadmin-commercial";

export function SuperadminRecommendationActions({
  recommendationId,
  clinicId,
}: {
  recommendationId: string | null;
  clinicId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (!recommendationId) {
    return (
      <p className="text-xs text-slate-500">
        Persistí migración 129 para dismiss/accept en DB. Mientras, usá el detalle de clínica.
      </p>
    );
  }

  function run(status: "dismissed" | "accepted" | "reviewed") {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("recommendationId", recommendationId!);
      fd.set("status", status);
      fd.set("clinicId", clinicId);
      const result = await setRecommendationStatusAction(fd);
      setMessage(result.ok ? `Marcado como ${status}.` : result.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run("reviewed")}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-50 dark:border-slate-600"
      >
        Reviewed
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run("dismissed")}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-50 dark:border-slate-600"
      >
        Dismiss
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run("accepted")}
        className="rounded-md bg-teal-700 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
      >
        Accept
      </button>
      {message ? <span className="text-xs text-slate-600">{message}</span> : null}
    </div>
  );
}

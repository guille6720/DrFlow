"use client";

import Link from "next/link";

type Props = {
  enqueued: number;
  jobIds?: string[];
};

export function ImportJobsQueuedBanner({ enqueued, jobIds }: Props) {
  if (enqueued <= 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50/80 px-4 py-3 text-sm text-teal-950">
      <p className="font-medium">
        {enqueued === 1 ? "1 trabajo encolado" : `${enqueued} trabajos encolados`} — procesando en
        segundo plano.
      </p>
      <p className="mt-1 text-teal-900/90">
        Seguí el progreso en{" "}
        <Link href="/configuracion?seccion=jobs" className="font-medium underline">
          Configuración → Cola de trabajos
        </Link>
        .
      </p>
      {jobIds && jobIds.length > 0 ? (
        <p className="mt-1 text-xs text-teal-800/80">
          IDs: {jobIds.slice(0, 3).map((id) => id.slice(0, 8)).join(", ")}
          {jobIds.length > 3 ? "…" : ""}
        </p>
      ) : null}
    </div>
  );
}

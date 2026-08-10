"use client";

function Block({ className }: { className?: string }) {
  return (
    <div
      className={[
        "animate-pulse rounded-xl border border-slate-700/40 bg-slate-800/50",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden
    />
  );
}

/** Placeholder for below-the-fold dashboard widgets while secondary data streams. */
export function ClinicalOpsSecondarySkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando tareas y pendientes">
      <Block className="h-28" />
      <Block className="h-36" />
      <Block className="h-32" />
      <Block className="h-24" />
    </div>
  );
}

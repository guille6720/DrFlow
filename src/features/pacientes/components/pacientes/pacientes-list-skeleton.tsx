"use client";

function Line({ className }: { className?: string }) {
  return (
    <div
      className={["animate-pulse rounded-lg bg-slate-700/50", className].filter(Boolean).join(" ")}
      aria-hidden
    />
  );
}

/** List rows placeholder while pacientes search navigation is in flight. */
export function PacientesListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Cargando pacientes">
      {Array.from({ length: rows }).map((_, i) => (
        <Line key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}

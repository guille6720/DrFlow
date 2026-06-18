export function PageSkeleton({ title = "Cargando…" }: { title?: string }) {
  return (
    <div className="animate-pulse p-4 sm:p-6">
      <div className="mb-6 h-8 w-48 rounded-lg bg-slate-200" />
      <div className="mb-2 h-4 w-64 rounded bg-slate-100" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-slate-100" />
        ))}
      </div>
      <div className="mt-6 h-64 rounded-2xl bg-slate-100" />
      <p className="sr-only">{title}</p>
    </div>
  );
}

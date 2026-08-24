import { MANUAL_SECTIONS } from "@/core/components/superadmin/manual/manual-data";

export function ManualNavigation({ visibleIds }: { visibleIds?: Set<string> }) {
  const items = MANUAL_SECTIONS.filter((s) => !visibleIds || visibleIds.has(s.id));

  return (
    <nav
      aria-label="Índice del manual"
      className="sticky top-4 hidden max-h-[calc(100vh-2rem)] w-56 shrink-0 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900 lg:block"
    >
      <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Contenido
      </p>
      <ul className="space-y-0.5">
        {items.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className="block rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100 hover:text-teal-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-teal-300"
            >
              {section.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

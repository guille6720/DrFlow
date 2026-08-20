import type { ReactNode } from "react";

import type { ManualSection } from "@/core/components/superadmin/manual/manual-data";
import { ManualImage } from "@/core/components/superadmin/manual/manual-image";

export function ManualSectionBlock({
  section,
  children,
  hidden,
}: {
  section: ManualSection;
  children: ReactNode;
  hidden?: boolean;
}) {
  if (hidden) return null;

  return (
    <section
      id={section.id}
      data-manual-section={section.id}
      className="scroll-mt-28 space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <header>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{section.title}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{section.summary}</p>
      </header>
      {section.image ? <ManualImage image={section.image} /> : null}
      <div className="prose-manual space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
        {children}
      </div>
    </section>
  );
}

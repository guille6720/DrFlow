import Link from "next/link";

import { cn } from "@/shared/utils/cn";

import { buildPacientesHistoriasUrl, buildPacientesSearchUrl } from "@/features/pacientes/utils/pacientes-page-url";

export type PacientesPageSection = "pacientes" | "historias";

type Props = {
  section: PacientesPageSection;
  q?: string;
  patologia?: string;
  cobertura?: string;
};

export function PacientesSectionNav({ section, q = "", patologia = "", cobertura }: Props) {
  const tabs: { id: PacientesPageSection; label: string; href: string }[] = [
    { id: "pacientes", label: "Pacientes", href: buildPacientesSearchUrl(q, cobertura, patologia) },
    {
      id: "historias",
      label: "Historias clínicas",
      href: buildPacientesHistoriasUrl({ q: q || undefined }),
    },
  ];

  return (
    <nav
      className="flex flex-wrap gap-2 rounded-xl border border-slate-600/80 bg-slate-800/90 p-1"
      aria-label="Secciones de pacientes"
    >
      {tabs.map((tab) => {
        const active = section === tab.id;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            prefetch
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition",
              active
                ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-md"
                : "text-slate-300 hover:bg-slate-700/80 hover:text-white"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

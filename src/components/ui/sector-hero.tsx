import type { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
}

export function SectorHero({ title, subtitle, icon: Icon }: Props) {
  return (
    <div className="mb-3 border-b border-slate-600/70 pb-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-md shadow-teal-500/30 ring-2 ring-teal-400/40 sm:h-12 sm:w-12">
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight text-slate-50 sm:text-2xl">{title}</h1>
          {subtitle ? (
            <p className="mt-1.5 max-w-3xl rounded-lg border border-teal-500/35 bg-slate-800/90 px-3 py-2 text-sm leading-relaxed text-slate-200 shadow-md shadow-black/20">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

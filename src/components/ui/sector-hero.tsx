import type { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
}

export function SectorHero({ title, subtitle, icon: Icon }: Props) {
  return (
    <div className="mb-8 border-b border-slate-600/70 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-lg shadow-teal-500/30 ring-2 ring-teal-400/40 sm:h-[4.5rem] sm:w-[4.5rem]">
          <Icon className="h-9 w-9 sm:h-10 sm:w-10" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">{title}</h1>
          {subtitle ? (
            <p className="mt-3 max-w-3xl rounded-xl border border-teal-500/35 bg-slate-800/90 px-4 py-3 text-base leading-relaxed text-slate-200 shadow-md shadow-black/20">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

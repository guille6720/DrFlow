import type { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
}

export function SectorHero({ title, subtitle, icon: Icon }: Props) {
  return (
    <div className="mb-8 border-b border-blue-100/80 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-900 text-white shadow-lg shadow-blue-900/25 sm:h-[4.5rem] sm:w-[4.5rem]">
          <Icon className="h-9 w-9 sm:h-10 sm:w-10" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
          {subtitle ? <p className="mt-2 max-w-2xl text-base text-slate-600">{subtitle}</p> : null}
        </div>
      </div>
    </div>
  );
}

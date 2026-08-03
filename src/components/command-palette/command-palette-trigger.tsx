"use client";

import { Search } from "lucide-react";
import { useCommandPalette } from "@/components/command-palette/command-palette-provider";
import { useFeatureFlag } from "@/components/plugins/clinic-plugins-provider";
import { cn } from "@/lib/utils/cn";

type Props = {
  className?: string;
  compact?: boolean;
};

export function CommandPaletteTrigger({ className, compact = false }: Props) {
  const { setOpen } = useCommandPalette();
  const enabled = useFeatureFlag("command_palette");

  if (!enabled) return null;

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        "inline-flex items-center gap-2 rounded-2xl border text-sm transition focus:outline-none focus:ring-2 focus:ring-teal-500/30",
        compact
          ? "h-11 w-11 justify-center border-slate-600 bg-slate-800 text-teal-300 hover:border-teal-500/50 hover:bg-slate-700"
          : "border-slate-600/80 bg-slate-800/80 px-3 py-2 text-slate-300 hover:border-teal-500/40 hover:bg-slate-800",
        className
      )}
      aria-label="Abrir búsqueda global"
      title="Buscar (Ctrl+K)"
    >
      <Search className="h-4 w-4 shrink-0" />
      {!compact ? (
        <>
          <span className="hidden min-w-[10rem] text-left text-slate-400 sm:inline">Buscar…</span>
          <kbd className="hidden rounded border border-slate-600 px-1.5 py-0.5 text-[10px] text-slate-500 md:inline">
            Ctrl+K
          </kbd>
        </>
      ) : null}
    </button>
  );
}

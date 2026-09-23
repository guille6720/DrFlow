"use client";

import { Search } from "lucide-react";

import { useCommandPalette } from "@/core/components/command-palette/command-palette-provider";
import { useUiThemeOptional } from "@/core/components/theme/ui-theme-provider";

import { cn } from "@/shared/utils/cn";

import { useFeatureFlag } from "@/features/plugins/components/plugins/clinic-features-provider";

type Props = {
  className?: string;
  compact?: boolean;
};

export function CommandPaletteTrigger({ className, compact = false }: Props) {
  const { setOpen } = useCommandPalette();
  const enabled = useFeatureFlag("command_palette");
  const theme = useUiThemeOptional();
  /** Prefer light chrome until theme hydrates — matches default claro dashboard. */
  const shellDark = theme?.clinicalDark ?? false;

  if (!enabled) return null;

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        "drflow-command-palette-trigger inline-flex items-center gap-2 rounded-2xl border text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-teal-500/30",
        compact
          ? shellDark
            ? "h-11 w-11 justify-center border-slate-600 bg-slate-800 text-teal-300 hover:border-teal-500/50 hover:bg-slate-700"
            : "h-11 w-11 justify-center border-slate-200 bg-white text-teal-700 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800"
          : shellDark
            ? "border-slate-600/80 bg-slate-800/80 px-3 py-2 text-slate-100 hover:border-teal-500/40 hover:bg-slate-800"
            : "border-slate-200 bg-white px-3 py-2 text-slate-800 shadow-sm hover:border-teal-200 hover:bg-teal-50/80",
        className
      )}
      aria-label="Abrir búsqueda global"
      title="Buscar (Ctrl+K)"
    >
      <Search className="h-4 w-4 shrink-0" aria-hidden />
      {!compact ? (
        <>
          <span
            className={cn(
              "hidden min-w-[10rem] text-left sm:inline",
              shellDark ? "text-slate-100" : "text-slate-800"
            )}
          >
            Buscar…
          </span>
          <kbd
            className={cn(
              "hidden rounded border px-1.5 py-0.5 text-[10px] font-semibold md:inline",
              shellDark
                ? "border-slate-500 text-slate-200"
                : "border-slate-300 text-slate-600"
            )}
          >
            Ctrl+K
          </kbd>
        </>
      ) : null}
    </button>
  );
}

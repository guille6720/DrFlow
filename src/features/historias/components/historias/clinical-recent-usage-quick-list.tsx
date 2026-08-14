"use client";

import { Clock } from "lucide-react";

import { cn } from "@/shared/utils/cn";

import type { ClinicalRecentUsageRow } from "@/features/historias/types/clinical-recent-usage";

type Props = {
  title?: string;
  items: ClinicalRecentUsageRow[];
  onPick: (item: ClinicalRecentUsageRow) => void;
  className?: string;
};

export function ClinicalRecentUsageQuickList({
  title = "Usados recientemente",
  items,
  onPick,
  className,
}: Props) {
  if (items.length === 0) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        <Clock className="h-3 w-3" aria-hidden />
        {title}
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onPick(item)}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-800 hover:border-slate-300 hover:bg-slate-100"
            >
              <Clock className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
              <span className="truncate font-medium">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

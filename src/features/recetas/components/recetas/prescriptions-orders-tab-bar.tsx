"use client";

import { ClipboardList, ScrollText } from "lucide-react";
import type { PrescriptionsOrdersTab } from "@/features/recetas/components/recetas/prescriptions-orders-types";
import { cn } from "@/shared/utils/cn";

type Props = {
  activeTab: PrescriptionsOrdersTab;
  onTabChange: (tab: PrescriptionsOrdersTab) => void;
};

export function PrescriptionsOrdersTabBar({ activeTab, onTabChange }: Props) {
  return (
    <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
      <button
        type="button"
        onClick={() => onTabChange("receta")}
        className={cn(
          "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition",
          activeTab === "receta"
            ? "bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-900 shadow-md"
            : "text-slate-600 hover:bg-slate-50"
        )}
      >
        <ScrollText className="h-4 w-4" />
        Receta
      </button>
      <button
        type="button"
        onClick={() => onTabChange("orden")}
        className={cn(
          "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition",
          activeTab === "orden"
            ? "bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-900 shadow-md"
            : "text-slate-600 hover:bg-slate-50"
        )}
      >
        <ClipboardList className="h-4 w-4" />
        Orden
      </button>
    </div>
  );
}

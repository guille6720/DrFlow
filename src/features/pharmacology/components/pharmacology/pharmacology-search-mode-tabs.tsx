import { Activity, BookOpen, Stethoscope } from "lucide-react";

import { cn } from "@/shared/utils/cn";

import type { PharmacologySearchMode } from "@/types/pharmacology";

interface Props {
  mode: PharmacologySearchMode;
  onSwitchMode: (mode: PharmacologySearchMode) => void;
}

export function PharmacologySearchModeTabs({ mode, onSwitchMode }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onSwitchMode("pathology")}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
          mode === "pathology"
            ? "bg-blue-600 text-white shadow-sm"
            : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
        )}
      >
        <Stethoscope className="h-4 w-4" />
        Por patología / CIE-10
      </button>
      <button
        type="button"
        onClick={() => onSwitchMode("symptoms")}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
          mode === "symptoms"
            ? "bg-violet-600 text-white shadow-sm"
            : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
        )}
      >
        <Activity className="h-4 w-4" />
        Por síntomas
      </button>
      <button
        type="button"
        onClick={() => onSwitchMode("vademecum")}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
          mode === "vademecum"
            ? "bg-emerald-600 text-white shadow-sm"
            : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
        )}
      >
        <BookOpen className="h-4 w-4" />
        Vademécum PAMI
      </button>
    </div>
  );
}

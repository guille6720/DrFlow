"use client";

import { cn } from "@/shared/utils/cn";
import type { PatientPortalScreen } from "@/features/pacientes/hooks/use-patient-portal";
import { PATIENT_PORTAL_NAV } from "@/features/pacientes/hooks/use-patient-portal";

type Props = {
  screen: PatientPortalScreen;
  onNavigate: (screen: PatientPortalScreen) => void;
};

export function PatientPortalBottomNav({ screen, onNavigate }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-safe backdrop-blur">
      <div className="mx-auto flex max-w-lg justify-around">
        {PATIENT_PORTAL_NAV.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === "inicio" ? screen === "inicio" : screen === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id === "inicio" ? "inicio" : item.id)}
              className={cn(
                "flex min-w-[4rem] flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition sm:text-xs",
                isActive ? "text-emerald-700" : "text-slate-500"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "text-emerald-600")} />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

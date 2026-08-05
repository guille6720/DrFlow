"use client";

import {
  Calendar,
  ClipboardList,
  Pill,
  Plus,
  Search,
  Stethoscope,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useCommandPalette } from "@/core/components/command-palette/command-palette-provider";

import { cn } from "@/shared/utils/cn";

import { useFeatureFlag } from "@/features/plugins/components/plugins/clinic-features-provider";

const ACTIONS = [
  { href: "/pacientes/nuevo", label: "Nuevo paciente", icon: Users },
  { href: "/agenda?action=new", label: "Nuevo turno", icon: Calendar },
  { href: "#", label: "Buscar paciente", icon: Search, palette: true },
  { href: "/recetas", label: "Nueva receta", icon: Pill },
  { href: "/historias/nueva", label: "Nueva SOAP", icon: Stethoscope },
  { href: "/recetas?tipo=orden", label: "Nueva orden", icon: ClipboardList },
] as const;

export function ClinicalOpsQuickActions() {
  const enabled = useFeatureFlag("floating_actions");
  const { setOpen: openPalette } = useCommandPalette();
  const [open, setOpen] = useState(false);

  if (!enabled) return null;

  return (
    <div className="fixed bottom-6 left-6 z-40 flex flex-col items-start gap-3 lg:bottom-8 lg:left-8">
      {open ? (
        <div className="flex flex-col items-start gap-2" role="menu" aria-label="Acciones clínicas rápidas">
          {ACTIONS.map((action, i) => {
            const Icon = action.icon;
            if ("palette" in action && action.palette) {
              return (
                <button
                  key={action.label}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    openPalette(true);
                    setOpen(false);
                  }}
                  className={cn(
                    "animate-fab-in flex items-center gap-2 rounded-full py-2 pl-3 pr-4 text-sm font-medium text-white shadow-lg",
                    "bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600"
                  )}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {action.label}
                </button>
              );
            }
            return (
              <Link
                key={action.href}
                href={action.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={cn(
                  "animate-fab-in flex items-center gap-2 rounded-full py-2 pl-3 pr-4 text-sm font-medium text-white shadow-lg",
                  "bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700"
                )}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {action.label}
              </Link>
            );
          })}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Cerrar acciones clínicas" : "Acciones clínicas rápidas"}
        aria-expanded={open}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-xl shadow-cyan-500/35",
          "hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400",
          open && "rotate-45 bg-gradient-to-br from-slate-600 to-slate-800"
        )}
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
    </div>
  );
}

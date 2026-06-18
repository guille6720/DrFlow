"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Plus,
  X,
  Calendar,
  Users,
  Stethoscope,
  Pill,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const actions = [
  {
    href: "/agenda?action=new",
    label: "Nuevo turno",
    icon: Calendar,
    color: "bg-blue-600 hover:bg-blue-700",
  },
  {
    href: "/pacientes/nuevo",
    label: "Nuevo paciente",
    icon: Users,
    color: "bg-indigo-600 hover:bg-indigo-700",
  },
  {
    href: "/historias/nueva",
    label: "Nueva consulta",
    icon: Stethoscope,
    color: "bg-sky-600 hover:bg-sky-700",
  },
  {
    href: "/herramientas/farmacologia",
    label: "Guía farmacológica",
    icon: Pill,
    color: "bg-teal-600 hover:bg-teal-700",
  },
  {
    href: "/herramientas/farmacologia?mode=symptoms",
    label: "Buscar por síntomas",
    icon: Pill,
    color: "bg-violet-600 hover:bg-violet-700",
  },
];

export function FloatingActions() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex flex-col items-end gap-2">
          {actions.map((action, i) => (
            <Link
              key={action.href}
              href={action.href}
              onClick={() => setOpen(false)}
              className={cn(
                "animate-fab-in flex items-center gap-2 rounded-full py-2 pl-3 pr-4 text-sm font-medium text-white shadow-lg",
                action.color
              )}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <action.icon className="h-4 w-4" />
              {action.label}
            </Link>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Cerrar acciones" : "Acciones rápidas"}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-xl shadow-blue-600/30",
          "hover:scale-105 hover:shadow-2xl hover:shadow-blue-600/40 active:scale-95",
          open && "rotate-45 bg-gradient-to-br from-slate-600 to-slate-800 shadow-slate-600/30"
        )}
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>

      {!open && (
        <div className="pointer-events-none absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-sky-400 text-[10px] font-bold text-white shadow">
          <MessageCircle className="h-3 w-3" />
        </div>
      )}
    </div>
  );
}

"use client";

import {
  Calendar,
  ClipboardList,
  Pill,
  Plus,
  Stethoscope,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useCopilotFabVisible } from "@/core/components/layout/unified-copilot-fab";

import { cn } from "@/shared/utils/cn";

import { useFeatureFlag } from "@/features/plugins/components/plugins/clinic-features-provider";

import {
  parsePatientIdFromPath,
  patientWorkflowHref,
} from "@/lib/utils/clinical-workflow-context";

type FabAction = {
  href: string;
  label: string;
  icon: typeof Calendar;
  color: string;
};

const globalActions: FabAction[] = [
  {
    href: "/agenda?action=new",
    label: "Nuevo turno",
    icon: Calendar,
    color: "bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600",
  },
  {
    href: "/pacientes/nuevo",
    label: "Nuevo paciente",
    icon: Users,
    color: "bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600",
  },
  {
    href: "/historias/nueva",
    label: "Nueva consulta",
    icon: Stethoscope,
    color: "bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700",
  },
  {
    href: "/herramientas/farmacologia",
    label: "Guía farmacológica",
    icon: Pill,
    color: "bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600",
  },
];

function patientActions(patientId: string): FabAction[] {
  return [
    {
      href: patientWorkflowHref(patientId, "soap"),
      label: "Nueva SOAP",
      icon: Stethoscope,
      color: "bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700",
    },
    {
      href: patientWorkflowHref(patientId, "prescription"),
      label: "Nueva receta",
      icon: Pill,
      color: "bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600",
    },
    {
      href: patientWorkflowHref(patientId, "order"),
      label: "Nueva orden",
      icon: ClipboardList,
      color: "bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600",
    },
  ];
}

export function FloatingActions() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const enabled = useFeatureFlag("floating_actions");
  const copilotFabVisible = useCopilotFabVisible();
  const patientId = parsePatientIdFromPath(pathname);
  const actions = patientId ? patientActions(patientId) : globalActions;

  if (!enabled || pathname === "/dashboard") {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col items-end gap-3",
        copilotFabVisible ? "bottom-24 right-6" : "bottom-6 right-6"
      )}
    >
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
          "flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-xl shadow-cyan-500/35",
          "hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/40 active:scale-95",
          open && "rotate-45 bg-gradient-to-br from-slate-600 to-slate-800 shadow-slate-600/30"
        )}
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
    </div>
  );
}

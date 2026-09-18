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

import { useCanUseFeature } from "@/core/components/entitlements/entitlements-provider";
import { useCopilotFabVisible } from "@/core/components/layout/unified-copilot-fab";
import { FEATURES } from "@/core/entitlements/features";

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
    href: "/turnos/nuevo",
    label: "Nuevo turno",
    icon: Calendar,
    color: "drflow-accent-fill",
  },
  {
    href: "/pacientes/nuevo",
    label: "Nuevo paciente",
    icon: Users,
    color: "drflow-accent-fill-secondary",
  },
  {
    href: "/consultas",
    label: "Nueva consulta",
    icon: Stethoscope,
    color: "drflow-accent-fill",
  },
  {
    href: "/herramientas/farmacologia",
    label: "Guía farmacológica",
    icon: Pill,
    color: "drflow-accent-fill-secondary",
  },
];

function patientActions(patientId: string): FabAction[] {
  return [
    {
      href: patientWorkflowHref(patientId, "soap"),
      label: "Nueva SOAP",
      icon: Stethoscope,
      color: "drflow-accent-fill",
    },
    {
      href: patientWorkflowHref(patientId, "prescription"),
      label: "Nueva receta",
      icon: Pill,
      color: "drflow-accent-fill-secondary",
    },
    {
      href: patientWorkflowHref(patientId, "order"),
      label: "Nueva orden",
      icon: ClipboardList,
      color: "drflow-accent-fill",
    },
  ];
}

export function FloatingActions() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const enabled = useFeatureFlag("floating_actions");
  const copilotFabVisible = useCopilotFabVisible();
  const canUsePharmacology = useCanUseFeature(FEATURES.PHARMACOLOGY);
  const patientId = parsePatientIdFromPath(pathname);
  const actions = patientId
    ? patientActions(patientId)
    : globalActions.filter(
        (action) =>
          action.href !== "/herramientas/farmacologia" || canUsePharmacology
      );

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
              prefetch
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
          "flex h-14 w-14 items-center justify-center rounded-full drflow-accent-fill text-white",
          "hover:scale-105 active:scale-95",
          open && "rotate-45 !bg-slate-700 !shadow-slate-600/30"
        )}
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
    </div>
  );
}

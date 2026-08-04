"use client";

import { useEffect, useState } from "react";
import { Accessibility, Keyboard } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  APP_KEYBOARD_SHORTCUTS,
  REDUCED_MOTION_STORAGE_KEY,
  WCAG_AA_FEATURES,
  type WcagFeatureStatus,
} from "@/core/accessibility/constants";
import { readReducedMotionPreference } from "@/core/accessibility/read-reduced-motion";

const STATUS_LABEL: Record<WcagFeatureStatus, string> = {
  done: "Implementado",
  partial: "Parcial",
  planned: "Planificado",
};

const STATUS_VARIANT: Record<WcagFeatureStatus, "success" | "warning" | "info"> = {
  done: "success",
  partial: "warning",
  planned: "info",
};

export function ClinicAccessibilityPanel() {
  const [reducedMotion, setReducedMotion] = useState(readReducedMotionPreference);

  useEffect(() => {
    document.documentElement.dataset.motion = reducedMotion ? "reduce" : "normal";
  }, [reducedMotion]);

  function toggleReducedMotion(enabled: boolean) {
    localStorage.setItem(REDUCED_MOTION_STORAGE_KEY, enabled ? "true" : "false");
    document.documentElement.dataset.motion = enabled ? "reduce" : "normal";
    setReducedMotion(enabled);
  }

  return (
    <Card title="Accesibilidad WCAG AA">
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <Accessibility className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          DrFlow prioriza teclado, foco visible, landmarks y lectores de pantalla. Esta sección
          documenta el cumplimiento WCAG 2.1 AA y atajos útiles para el staff.
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus-visible:ring-2 focus-visible:ring-teal-500"
            checked={reducedMotion}
            onChange={(e) => toggleReducedMotion(e.target.checked)}
          />
          <span>
            <span className="block text-sm font-medium text-slate-900">
              Reducir animaciones
            </span>
            <span className="mt-0.5 block text-sm text-slate-600">
              Minimiza transiciones y animaciones en esta sesión (además del ajuste del sistema).
            </span>
          </span>
        </label>
      </div>

      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Criterios WCAG</h3>
        <ul className="space-y-2">
          {WCAG_AA_FEATURES.map((feature) => (
            <li
              key={feature.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">
                  {feature.label}
                  {feature.criterion ? (
                    <span className="ml-1 font-normal text-slate-500">
                      ({feature.criterion})
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-slate-600">{feature.description}</p>
              </div>
              <Badge variant={STATUS_VARIANT[feature.status]}>
                {STATUS_LABEL[feature.status]}
              </Badge>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Keyboard className="h-4 w-4" />
          Atajos de teclado
        </h3>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Atajo</th>
                <th className="px-3 py-2 font-medium">Acción</th>
                <th className="px-3 py-2 font-medium">Contexto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {APP_KEYBOARD_SHORTCUTS.map((shortcut) => (
                <tr key={`${shortcut.keys}-${shortcut.action}`}>
                  <td className="px-3 py-2 font-mono text-xs text-slate-800">{shortcut.keys}</td>
                  <td className="px-3 py-2 text-slate-700">{shortcut.action}</td>
                  <td className="px-3 py-2 text-slate-500">{shortcut.context ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

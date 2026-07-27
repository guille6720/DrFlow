"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUiTheme } from "@/components/theme/ui-theme-provider";
import { UI_STYLE_LABELS, type UiStyleId } from "@/lib/theme/ui-theme";
import { LayoutGrid, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function AppearanceStylePanel() {
  const { style, clinicalDark, setStyle, setClinicalDark } = useUiTheme();

  return (
    <Card
      title="Apariencia de la interfaz"
      description="Estilo 2: diseño plano minimalista con distribución Bento. Podés activar Clinical Dark Mode solo en Estilo 2."
    >
      <div className="space-y-6">
        <div>
          <p className="mb-3 text-sm font-medium text-slate-200">Preset de estilo</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["1", "2"] as UiStyleId[]).map((id) => {
              const active = style === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setStyle(id)}
                  className={cn(
                    "rounded-xl border p-4 text-left transition",
                    active
                      ? "border-teal-400 bg-teal-500/10 ring-2 ring-teal-400/40"
                      : "border-slate-500/50 bg-slate-800/40 hover:border-slate-400"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="h-5 w-5 text-teal-300" />
                    <span className="font-semibold text-slate-50">Estilo {id}</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300">
                    {UI_STYLE_LABELS[id]}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {style === "2" && (
          <div className="rounded-xl border border-slate-500/50 bg-slate-800/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-semibold text-slate-50">
                  {clinicalDark ? (
                    <Moon className="h-4 w-4 text-teal-300" />
                  ) : (
                    <Sun className="h-4 w-4 text-amber-300" />
                  )}
                  Clinical Dark Mode
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  {clinicalDark
                    ? "Fondo oscuro clínico, bordes planos y alto contraste para turnos nocturnos."
                    : "Modo claro plano: fondo gris muy suave, tarjetas blancas y rejilla Bento."}
                </p>
              </div>
              <Button
                type="button"
                variant={clinicalDark ? "primary" : "outline"}
                size="sm"
                onClick={() => setClinicalDark(!clinicalDark)}
              >
                {clinicalDark ? "Usar modo claro" : "Activar modo oscuro"}
              </Button>
            </div>
          </div>
        )}

        <p className="text-xs text-slate-400">
          La preferencia se guarda en este navegador (Estilo 2 + dark mode). Estilo 1 mantiene el
          look clínico teal actual.
        </p>
      </div>
    </Card>
  );
}

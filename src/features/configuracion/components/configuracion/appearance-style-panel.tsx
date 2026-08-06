"use client";

import { Droplets, Layers, LayoutGrid, Mic, Moon, Sun } from "lucide-react";

import { useUiTheme } from "@/core/components/theme/ui-theme-provider";
import { UI_STYLE_LABELS, type UiStyleId } from "@/core/theme/ui-theme";

import { cn } from "@/shared/utils/cn";

import { useVoiceInputOptional } from "@/features/voice/components/voice/voice-input-provider";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const STYLE_ICONS: Record<UiStyleId, typeof LayoutGrid> = {
  "1": LayoutGrid,
  "2": LayoutGrid,
  "3": Droplets,
  "4": Layers,
};

const STYLE_ACTIVE_RING: Record<UiStyleId, string> = {
  "1": "border-teal-400 bg-teal-500/10 ring-teal-400/40",
  "2": "border-teal-400 bg-teal-500/10 ring-teal-400/40",
  "3": "border-sky-400 bg-sky-500/10 ring-sky-400/40",
  "4": "border-blue-400 bg-blue-500/10 ring-blue-400/40",
};

const STYLE_ICON_COLOR: Record<UiStyleId, string> = {
  "1": "text-teal-300",
  "2": "text-teal-300",
  "3": "text-sky-300",
  "4": "text-blue-300",
};

const BENTO_STYLES: UiStyleId[] = ["2", "3", "4"];

function AppearanceStyleControls() {
  const { style, clinicalDark, setStyle, setClinicalDark } = useUiTheme();
  const voice = useVoiceInputOptional();

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-medium text-slate-700">Preset de estilo</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(["1", "2", "3", "4"] as UiStyleId[]).map((id) => {
            const active = style === id;
            const Icon = STYLE_ICONS[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => setStyle(id)}
                className={cn(
                  "rounded-xl border p-4 text-left transition",
                  active
                    ? cn("ring-2", STYLE_ACTIVE_RING[id])
                    : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/50"
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      active ? STYLE_ICON_COLOR[id] : "text-slate-500"
                    )}
                  />
                  <span className="font-semibold text-slate-900">Estilo {id}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  {UI_STYLE_LABELS[id]}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {BENTO_STYLES.includes(style) && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 font-semibold text-slate-900">
                {clinicalDark ? (
                  <Moon className="h-4 w-4 text-blue-600" />
                ) : (
                  <Sun className="h-4 w-4 text-amber-500" />
                )}
                Clinical Dark Mode
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {style === "4"
                  ? clinicalDark
                    ? "Azul profundo nocturno; tarjetas claras con texto oscuro nítido."
                    : "Fondo azul cobalto saturado; tarjetas blancas de alto contraste."
                  : clinicalDark
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

      {voice ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 font-semibold text-slate-900">
                <Mic className="h-4 w-4 text-blue-600" />
                Dictado por voz (historias clínicas)
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {voice.clinicEnabled
                  ? voice.userEnabled
                    ? "Activo en este navegador. Usá el botón Dictar junto a cada campo de texto."
                    : "Desactivado en este navegador. Podés volver a activarlo cuando quieras."
                  : "El administrador del consultorio desactivó el dictado por voz."}
                {!voice.browserSupported && voice.clinicEnabled ? (
                  <span className="mt-1 block text-amber-700">
                    Tu navegador no soporta reconocimiento de voz (probá Chrome o Edge).
                  </span>
                ) : null}
              </p>
            </div>
            <Button
              type="button"
              variant={voice.userEnabled ? "primary" : "outline"}
              size="sm"
              disabled={!voice.clinicEnabled || !voice.envEnabled}
              onClick={() => voice.setUserEnabled(!voice.userEnabled)}
            >
              {voice.userEnabled ? "Desactivar dictado" : "Activar dictado"}
            </Button>
          </div>
        </div>
      ) : null}

      <p className="text-xs text-slate-600">
        La preferencia se guarda en este navegador. Estilo 4 usa el azul de acción (#2563eb) como
        fondo principal y mantiene formularios y tarjetas en superficies claras para lectura nítida.
      </p>
    </div>
  );
}

export function AppearanceStylePanel({ embedded = false }: { embedded?: boolean }) {
  if (embedded) {
    return <AppearanceStyleControls />;
  }

  return (
    <Card
      title="Apariencia de la interfaz"
      description="Estilos 2–4 usan diseño plano con rejilla Bento. El Estilo 4 aplica fondo azul cobalto (#2563eb) con tarjetas claras para máxima nitidez. Podés activar modo oscuro en Estilos 2–4."
    >
      <AppearanceStyleControls />
    </Card>
  );
}

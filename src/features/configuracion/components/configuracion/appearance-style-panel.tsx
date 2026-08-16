"use client";

import { Droplets, Heart, LayoutGrid, Mic, Moon, Sun, Trees } from "lucide-react";

import { useUiTheme } from "@/core/components/theme/ui-theme-provider";
import { UI_STYLE_BLURBS, UI_STYLE_LABELS, type UiStyleId } from "@/core/theme/ui-theme";

import { cn } from "@/shared/utils/cn";

import { useVoiceInputOptional } from "@/features/voice/components/voice/voice-input-provider";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const STYLE_ICONS: Record<UiStyleId, typeof LayoutGrid> = {
  "1": LayoutGrid,
  "2": Trees,
  "3": Droplets,
  "4": Heart,
};

const STYLE_ACTIVE_RING: Record<UiStyleId, string> = {
  "1": "border-blue-500 bg-blue-500/10 ring-blue-500/40",
  "2": "border-emerald-500 bg-emerald-500/10 ring-emerald-500/40",
  "3": "border-slate-500 bg-slate-500/10 ring-slate-500/40",
  "4": "border-orange-500 bg-orange-500/10 ring-orange-500/40",
};

const STYLE_ICON_COLOR: Record<UiStyleId, string> = {
  "1": "text-blue-600",
  "2": "text-emerald-600",
  "3": "text-slate-600",
  "4": "text-orange-600",
};

const DARK_BLURBS: Record<UiStyleId, { light: string; dark: string }> = {
  "1": {
    light: "Azul médico clásico: navegación navy, fondos claros y enlaces azul brillante.",
    dark: "Azul profundo nocturno con acentos #3B82F6 y contraste alto para turnos de noche.",
  },
  "2": {
    light: "Verde bienestar: menta suave, navegación esmeralda y alertas ámbar.",
    dark: "Fondos verdes neutros, texto claro y acentos esmeralda suaves.",
  },
  "3": {
    light: "Minimalismo moderno: estructura slate, bordes neutros y acento índigo.",
    dark: "Slate oscuro plano, bordes definidos y rojo nítido para errores.",
  },
  "4": {
    light: "Cálido y empático: naranja de acción, teal suave y tipografía forestal.",
    dark: "Teal profundo nocturno con acentos naranja y superficies elevadas.",
  },
};

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
                <p className="mt-2 text-xs font-medium leading-relaxed text-slate-800">
                  {UI_STYLE_LABELS[id]}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{UI_STYLE_BLURBS[id]}</p>
              </button>
            );
          })}
        </div>
      </div>

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
              {clinicalDark ? DARK_BLURBS[style].dark : DARK_BLURBS[style].light}
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
        La preferencia se guarda en este navegador. Los cuatro presets incluyen modo claro y
        oscuro clínico.
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
      description="Cuatro paletas clínicas con modo claro y oscuro. Estilos 2–4 usan diseño plano con rejilla Bento."
    >
      <AppearanceStyleControls />
    </Card>
  );
}

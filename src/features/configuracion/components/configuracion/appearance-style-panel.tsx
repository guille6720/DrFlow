"use client";

import { Mic, Moon, Sun } from "lucide-react";

import { useUiTheme } from "@/core/components/theme/ui-theme-provider";
import { UI_STYLE_BLURB, UI_STYLE_LABEL } from "@/core/theme/ui-theme";

import { useVoiceInputOptional } from "@/features/voice/components/voice/voice-input-provider";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function AppearanceStyleControls() {
  const { clinicalDark, setClinicalDark } = useUiTheme();
  const voice = useVoiceInputOptional();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">{UI_STYLE_LABEL}</p>
        <p className="mt-1 text-xs text-slate-600">{UI_STYLE_BLURB}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-semibold text-slate-900">
              {clinicalDark ? (
                <Moon className="h-4 w-4 text-teal-600" />
              ) : (
                <Sun className="h-4 w-4 text-amber-500" />
              )}
              Modo oscuro
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {clinicalDark
                ? "Fondos teal oscuros, texto claro y acentos teal suaves para turnos nocturnos."
                : "Sidebar blanca, acento teal y fondos neutros claros."}
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
                <Mic className="h-4 w-4 text-teal-600" />
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
        La preferencia de modo claro/oscuro se guarda en este navegador.
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
      description="Tema teal clínico unificado con modo claro y oscuro."
    >
      <AppearanceStyleControls />
    </Card>
  );
}

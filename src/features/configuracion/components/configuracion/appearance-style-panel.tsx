"use client";

import { Droplets, Layers, LayoutGrid, Mic, Moon, Sun } from "lucide-react";

import { AddonUpgradeNotice } from "@/core/components/entitlements/addon-upgrade-notice";
import { useCanUseVoiceInput } from "@/core/components/entitlements/entitlements-provider";
import { useUiTheme } from "@/core/components/theme/ui-theme-provider";
import { FEATURES } from "@/core/entitlements/features";
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
  const canUseVoice = useCanUseVoiceInput();

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-medium text-[var(--muted-foreground,#475569)]">Preset de estilo</p>
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
                    : "border-[var(--border)] bg-[var(--muted)] hover:border-[var(--ring)]"
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      active ? STYLE_ICON_COLOR[id] : "text-[var(--muted-foreground)]"
                    )}
                  />
                  <span className="font-semibold text-[var(--foreground)]">Estilo {id}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                  {UI_STYLE_LABELS[id]}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {BENTO_STYLES.includes(style) && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
                {clinicalDark ? (
                  <Moon className="h-4 w-4 text-[var(--accent)]" />
                ) : (
                  <Sun className="h-4 w-4 text-[var(--warning)]" />
                )}
                Clinical Dark Mode
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground,#475569)]">
                {style === "4"
                  ? clinicalDark
                    ? "Azul profundo nocturno; tarjetas claras con texto oscuro nítido."
                    : "Fondo azul cobalto saturado; tarjetas blancas de alto contraste."
                  : style === "2"
                    ? clinicalDark
                      ? "Clinical Blue + Teal oscuro: fondo #0B1220, acento teal y alto contraste nocturno."
                      : "Clinical Blue + Teal claro: fondo #F8FAFC, primary #0F4C5C y lectura clínica nítida."
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
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
                <Mic className="h-4 w-4 text-[var(--accent)]" />
                Dictado por voz (historias clínicas)
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {!canUseVoice
                  ? "El dictado por voz no está incluido en el plan comercial del consultorio."
                  : voice.clinicEnabled
                    ? voice.userEnabled
                      ? "Activo en este navegador. Usá el botón Dictar junto a cada campo de texto."
                      : "Desactivado en este navegador. Podés volver a activarlo cuando quieras."
                    : "El administrador del consultorio desactivó el dictado por voz."}
                {canUseVoice && !voice.browserSupported && voice.clinicEnabled ? (
                  <span className="mt-1 block text-amber-700">
                    Tu navegador no soporta reconocimiento de voz (probá Chrome o Edge).
                  </span>
                ) : null}
              </p>
              {!canUseVoice ? (
                <div className="mt-3 space-y-2">
                  <AddonUpgradeNotice feature={FEATURES.VOICE} />
                  <AddonUpgradeNotice feature={FEATURES.AI_TRANSCRIPTION} />
                </div>
              ) : null}
            </div>
            <Button
              type="button"
              variant={voice.userEnabled ? "primary" : "outline"}
              size="sm"
              disabled={!canUseVoice || !voice.clinicEnabled || !voice.envEnabled}
              onClick={() => voice.setUserEnabled(!voice.userEnabled)}
            >
              {voice.userEnabled ? "Desactivar dictado" : "Activar dictado"}
            </Button>
          </div>
        </div>
      ) : null}

      <p className="text-xs text-[var(--muted-foreground,#475569)]">
        La preferencia se guarda en este navegador. El Estilo 2 (Clinical Blue + Teal) es el recomendado
        para consulta diaria: alto contraste, modo claro/oscuro y superficies clínicas limpias.
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
      description="Estilos 2–4 usan diseño plano con rejilla Bento. El Estilo 2 aplica la paleta Clinical Blue + Teal (claro/oscuro). Podés activar modo oscuro en Estilos 2–4."
    >
      <AppearanceStyleControls />
    </Card>
  );
}

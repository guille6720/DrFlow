"use client";

import { Droplets, Layers, Mic, Moon, Palette, Sparkles, Sun, Zap } from "lucide-react";

import { AddonUpgradeNotice } from "@/core/components/entitlements/addon-upgrade-notice";
import { useCanUseVoiceInput } from "@/core/components/entitlements/entitlements-provider";
import { useUiTheme } from "@/core/components/theme/ui-theme-provider";
import { FEATURES } from "@/core/entitlements/features";
import { UI_STYLE_IDS, UI_STYLE_LABELS, type UiStyleId } from "@/core/theme/ui-theme";

import { cn } from "@/shared/utils/cn";

import { useVoiceInputOptional } from "@/features/voice/components/voice/voice-input-provider";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const STYLE_ICONS: Record<UiStyleId, typeof Sparkles> = {
  "2": Sparkles,
  "3": Droplets,
  "4": Layers,
  "5": Palette,
  "6": Zap,
};

const STYLE_SWATCHES: Record<UiStyleId, string[]> = {
  "2": ["#F8FAFC", "#0F4C5C", "#0F766E", "#0B1220"],
  "3": ["#e8f2fc", "#0284c7", "#38bdf8"],
  "4": ["#2563eb", "#1d4ed8", "#ffffff"],
  "5": ["#F9FAFB", "#0D9488", "#F3E8FF", "#DCFCE7", "#0B1118"],
  "6": ["#07182D", "#5CB8F6", "#8457F4", "#F84FA3", "#FFBC58", "#56D3DE"],
};

const BENTO_STYLES: UiStyleId[] = ["2", "3", "4", "5", "6"];

function darkModeHint(style: UiStyleId, clinicalDark: boolean): string {
  if (style === "6") {
    return clinicalDark
      ? "Midnight Navy (#07182D): azul, violeta, magenta y cian con alto contraste clínico."
      : "Midnight Navy claro: superficies blancas con acento #5CB8F6 (sidebar navy).";
  }
  if (style === "5") {
    return clinicalDark
      ? "Soft Clinic oscuro (#0B1118): teal activo, chips pastel adaptados y alto contraste."
      : "Soft Clinic claro: fondo #F9FAFB, sidebar blanca, activo teal #0D9488 y acentos pastel.";
  }
  if (style === "4") {
    return clinicalDark
      ? "Azul profundo nocturno; tarjetas claras con texto oscuro nítido."
      : "Fondo azul cobalto saturado; tarjetas blancas de alto contraste.";
  }
  if (style === "2") {
    return clinicalDark
      ? "Modo oscuro Clinical Blue (#0B1220)."
      : "Clinical Blue + Teal claro: fondo #F8FAFC, primary #0F4C5C.";
  }
  return clinicalDark
    ? "Fondo oscuro clínico, bordes planos y alto contraste para turnos nocturnos."
    : "Modo claro plano: fondo gris muy suave, tarjetas blancas y rejilla Bento.";
}

function AppearanceStyleControls() {
  const { style, clinicalDark, setStyle, setClinicalDark } = useUiTheme();
  const voice = useVoiceInputOptional();
  const canUseVoice = useCanUseVoiceInput();

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-medium text-[var(--text-secondary,var(--muted-foreground,#334155))]">
          Preset de estilo
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {UI_STYLE_IDS.map((id) => {
            const active = style === id;
            const Icon = STYLE_ICONS[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => setStyle(id)}
                aria-pressed={active}
                data-selected={active ? "true" : "false"}
                className={cn(
                  "drflow-theme-option rounded-xl border p-4 text-left transition ring-offset-2",
                  active
                    ? "ring-2 ring-[var(--ring)]"
                    : "hover:border-[var(--ring)]"
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon
                    className={cn(
                      "h-5 w-5 shrink-0",
                      active
                        ? "text-[var(--text-on-selected)]"
                        : "text-[var(--text-secondary,var(--muted-foreground))]"
                    )}
                  />
                  <span className="drflow-theme-option-title font-semibold">
                    Estilo {id}
                  </span>
                  {id === "6" ? (
                    <span className="rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--primary-foreground)]">
                      Nuevo
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {STYLE_SWATCHES[id].map((color) => (
                    <span
                      key={color}
                      className="h-3.5 w-3.5 rounded-full border border-black/20"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
                <p className="drflow-theme-option-desc mt-2 text-xs leading-relaxed">
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
              <p className="flex items-center gap-2 font-semibold text-[var(--text-primary,var(--foreground))]">
                {clinicalDark ? (
                  <Moon className="h-4 w-4 text-[var(--accent)]" />
                ) : (
                  <Sun className="h-4 w-4 text-[var(--warning)]" />
                )}
                Clinical Dark Mode
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary,var(--muted-foreground))]">
                {darkModeHint(style, clinicalDark)}
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
              <p className="flex items-center gap-2 font-semibold text-[var(--text-primary,var(--foreground))]">
                <Mic className="h-4 w-4 text-[var(--accent)]" />
                Dictado por voz (historias clínicas)
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary,var(--muted-foreground))]">
                {!canUseVoice
                  ? "El dictado por voz no está incluido en el plan comercial del consultorio."
                  : voice.clinicEnabled
                    ? voice.userEnabled
                      ? "Activo en este navegador. Usá el botón Dictar junto a cada campo de texto."
                      : "Desactivado en este navegador. Podés volver a activarlo cuando quieras."
                    : "El administrador del consultorio desactivó el dictado por voz."}
                {canUseVoice && !voice.browserSupported && voice.clinicEnabled ? (
                  <span className="mt-1 block text-[var(--warning)]">
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

      <p className="text-xs text-[var(--text-secondary,var(--muted-foreground))]">
        La preferencia se guarda en este navegador. El Estilo 6 (Midnight Navy) es el recomendado
        por contraste clínico; los demás presets siguen disponibles.
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
      description="Elegí un estilo visual. Midnight Navy es el default. El modo oscuro clínico está disponible en todos los presets Bento (2–6)."
    >
      <AppearanceStyleControls />
    </Card>
  );
}

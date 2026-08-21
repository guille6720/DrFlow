"use client";

import { Droplets, Layers, LayoutGrid, Mic, Moon, Sparkles, Sun } from "lucide-react";

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
  "2": Sparkles,
  "3": Droplets,
  "4": Layers,
};

const STYLE_ACTIVE_RING: Record<UiStyleId, string> = {
  "1": "border-teal-400 bg-teal-500/10 ring-teal-400/40",
  "2": "border-[var(--accent,#0F766E)] bg-[var(--accent-soft,#ECFDF5)] ring-[var(--accent,#0F766E)]/40",
  "3": "border-sky-400 bg-sky-500/10 ring-sky-400/40",
  "4": "border-blue-400 bg-blue-500/10 ring-blue-400/40",
};

const STYLE_ICON_COLOR: Record<UiStyleId, string> = {
  "1": "text-teal-600",
  "2": "text-[var(--accent,#0F766E)]",
  "3": "text-sky-600",
  "4": "text-blue-600",
};

const STYLE_SWATCHES: Record<UiStyleId, string[]> = {
  "1": ["#3d5266", "#2dd4bf", "#0f172a"],
  "2": ["#F8FAFC", "#0F4C5C", "#0F766E", "#0B1220"],
  "3": ["#e8f2fc", "#0284c7", "#38bdf8"],
  "4": ["#2563eb", "#1d4ed8", "#ffffff"],
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
                    : "border-[var(--border,#D7E0E8)] bg-[var(--card,#fff)] hover:border-[var(--ring,#0F766E)]"
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      active ? STYLE_ICON_COLOR[id] : "text-[var(--muted-foreground,#475569)]"
                    )}
                  />
                  <span className="font-semibold text-[var(--foreground,#0F172A)]">Estilo {id}</span>
                  {id === "2" ? (
                    <span className="rounded-full bg-[var(--accent,#0F766E)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      Nuevo
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex gap-1">
                  {STYLE_SWATCHES[id].map((color) => (
                    <span
                      key={color}
                      className="h-3.5 w-3.5 rounded-full border border-black/10"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[var(--muted-foreground,#475569)]">
                  {UI_STYLE_LABELS[id]}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {BENTO_STYLES.includes(style) && (
        <div className="rounded-xl border border-[var(--border,#D7E0E8)] bg-[var(--muted,#F1F5F9)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 font-semibold text-[var(--foreground,#0F172A)]">
                {clinicalDark ? (
                  <Moon className="h-4 w-4 text-[var(--accent,#0F766E)]" />
                ) : (
                  <Sun className="h-4 w-4 text-[var(--warning,#B45309)]" />
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
                      ? "Modo oscuro activo (#0B1220). Tocá «Usar modo claro» para ver la paleta Clinical Blue nueva (#0F4C5C)."
                      : "Modo claro Clinical Blue + Teal: fondo #F8FAFC, primary #0F4C5C, acento #0F766E."
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
        <div className="rounded-xl border border-[var(--border,#D7E0E8)] bg-[var(--muted,#F1F5F9)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 font-semibold text-[var(--foreground,#0F172A)]">
                <Mic className="h-4 w-4 text-[var(--accent,#0F766E)]" />
                Dictado por voz (historias clínicas)
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground,#475569)]">
                {!canUseVoice
                  ? "El dictado por voz no está incluido en el plan comercial del consultorio."
                  : voice.clinicEnabled
                    ? voice.userEnabled
                      ? "Activo en este navegador. Usá el botón Dictar junto a cada campo de texto."
                      : "Desactivado en este navegador. Podés volver a activarlo cuando quieras."
                    : "El administrador del consultorio desactivó el dictado por voz."}
                {canUseVoice && !voice.browserSupported && voice.clinicEnabled ? (
                  <span className="mt-1 block text-[var(--warning,#B45309)]">
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
        La preferencia se guarda en este navegador. El Estilo 2 (badge Nuevo) es Clinical Blue + Teal:
        elegilo y usá modo claro para ver el cambio de colores.
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
      description="Estilos 2–4 usan diseño plano con rejilla Bento. El Estilo 2 (Nuevo) aplica Clinical Blue + Teal. Podés activar modo oscuro en Estilos 2–4."
    >
      <AppearanceStyleControls />
    </Card>
  );
}

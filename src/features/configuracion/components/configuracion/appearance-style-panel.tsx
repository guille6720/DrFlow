"use client";

import { Mic, Monitor, Moon, Palette, Sparkles, Sun } from "lucide-react";

import { AddonUpgradeNotice } from "@/core/components/entitlements/addon-upgrade-notice";
import { useCanUseVoiceInput } from "@/core/components/entitlements/entitlements-provider";
import { useUiTheme } from "@/core/components/theme/ui-theme-provider";
import { FEATURES } from "@/core/entitlements/features";
import {
  type AppearanceMode,
  UI_STYLE_IDS,
  UI_STYLE_LABELS,
  type UiStyleId,
} from "@/core/theme/ui-theme";

import { cn } from "@/shared/utils/cn";

import { useVoiceInputOptional } from "@/features/voice/components/voice/voice-input-provider";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const STYLE_ICONS: Record<UiStyleId, typeof Sparkles> = {
  "clinical-blue": Sparkles,
  "medical-slate": Palette,
};

const STYLE_SWATCHES: Record<UiStyleId, string[]> = {
  "clinical-blue": ["#F5F7F9", "#FFFFFF", "#0D63D8", "#0F766E", "#08111F"],
  "medical-slate": ["#F5F7F9", "#FFFFFF", "#2563EB", "#0F766E", "#0D1117"],
};

const APPEARANCE_MODES: Array<{
  id: AppearanceMode;
  label: string;
  icon: typeof Sun;
}> = [
  { id: "light", label: "Claro", icon: Sun },
  { id: "dark", label: "Oscuro", icon: Moon },
  { id: "system", label: "Sistema", icon: Monitor },
];

function AppearanceStyleControls() {
  const { style, appearanceMode, setStyle, setAppearanceMode } = useUiTheme();
  const voice = useVoiceInputOptional();
  const canUseVoice = useCanUseVoiceInput();

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-medium text-[var(--text-secondary,var(--muted-foreground,#667085))]">
          Paleta
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
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
                  active ? "ring-2 ring-[var(--ring)]" : "hover:border-[var(--ring)]"
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
                    {UI_STYLE_LABELS[id]}
                  </span>
                  {id === "clinical-blue" ? (
                    <span className="rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--primary-foreground)]">
                      Default
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {STYLE_SWATCHES[id].map((color) => (
                    <span
                      key={color}
                      className="h-3.5 w-3.5 rounded-full border border-[var(--border)]"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
                <p className="drflow-theme-option-desc mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                  {id === "clinical-blue"
                    ? "Azul clínico con sidebar navy y acentos teal. Alta legibilidad médica."
                    : "Slate médico con acento violeta. Profesional y neutro."}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-4">
        <p className="mb-3 font-semibold text-[var(--text-primary,var(--foreground))]">Modo</p>
        <div className="grid grid-cols-3 gap-2">
          {APPEARANCE_MODES.map((mode) => {
            const active = appearanceMode === mode.id;
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setAppearanceMode(mode.id)}
                aria-pressed={active}
                className={cn(
                  "inline-flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-sm font-medium transition",
                  active
                    ? "border-[var(--primary)] bg-[var(--surface-selected)] text-[var(--text-on-selected)] ring-2 ring-[var(--ring)]"
                    : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--ring)]"
                )}
              >
                <Icon className="h-4 w-4" />
                {mode.label}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-[var(--text-secondary,var(--muted-foreground))]">
          Sistema sigue la preferencia de apariencia del sistema operativo.
        </p>
      </div>

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
        La preferencia se guarda solo en este navegador. No modifica datos clínicos ni de
        usuario en el servidor. Clinical Blue es la paleta por defecto de NexClinic.
      </p>
    </div>
  );
}

type Props = {
  embedded?: boolean;
};

export function AppearanceStylePanel({ embedded = false }: Props) {
  if (embedded) {
    return <AppearanceStyleControls />;
  }

  return (
    <Card title="Apariencia" description="Paleta oficial y modo claro / oscuro / sistema.">
      <AppearanceStyleControls />
    </Card>
  );
}

"use client";

import { Mic } from "lucide-react";

import { AddonUpgradeNotice } from "@/core/components/entitlements/addon-upgrade-notice";
import { useCanUseVoiceInput } from "@/core/components/entitlements/entitlements-provider";
import { FEATURES } from "@/core/entitlements/features";

import { useVoiceInputOptional } from "@/features/voice/components/voice/voice-input-provider";

import { Button } from "@/components/ui/button";

/** Per-browser voice dictation toggle; renders nothing outside a VoiceInputProvider. */
export function VoiceDictationPreferenceCard() {
  const voice = useVoiceInputOptional();
  const canUseVoice = useCanUseVoiceInput();

  if (!voice) return null;

  return (
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
  );
}

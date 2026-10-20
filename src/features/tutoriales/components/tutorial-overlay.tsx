"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { BRAND_NAME } from "@/core/brand/brand";

import { cn } from "@/shared/utils/cn";

import { TutorialCursor } from "@/features/tutoriales/components/tutorial-cursor";
import { TutorialPlaybackBar } from "@/features/tutoriales/components/tutorial-playback-bar";
import type { TutorialEngineApi } from "@/features/tutoriales/components/use-tutorial-engine";
import {
  type ContinuousNarrationClip,
  getContinuousNarrationSession,
} from "@/features/tutoriales/lib/continuous-narration-session";
import { prefersReducedMotion } from "@/features/tutoriales/lib/prefers-reduced-motion";
import {
  clampNarrationRate,
  readNarrationPreferences,
  type SpeechNarrationStatus,
  type StoredVoiceProfile,
  writeNarrationPreferences,
} from "@/features/tutoriales/lib/speech-narration";
import { migrateLegacyVoiceProfile } from "@/features/tutoriales/lib/voice-profiles";

interface TutorialOverlayProps {
  engine: TutorialEngineApi;
}

function buildPlaylist(engine: TutorialEngineApi): ContinuousNarrationClip[] {
  const { state } = engine;
  const tutorial = state.tutorial;
  if (!tutorial) return [];

  return tutorial.steps.map((step, stepIndex) => {
    let text = step.narration?.trim() || step.body;
    if (state.mode === "demo") {
      const scene = tutorial.demoScenes.find((s) => s.id === step.demoSceneId);
      if (scene?.narration?.trim()) text = scene.narration.trim();
    }
    return {
      stepIndex,
      text,
      clipId: step.id,
    };
  });
}

export function TutorialOverlay({ engine }: TutorialOverlayProps) {
  const { state, skip, pause, resume, skipIntro } = engine;
  const session = useMemo(() => getContinuousNarrationSession(), []);
  const sessionKeyRef = useRef<string | null>(null);
  const engineRef = useRef(engine);
  const initialPrefs = useMemo(() => readNarrationPreferences(), []);

  const [muted, setMuted] = useState(initialPrefs.muted);
  const [rate, setRate] = useState(initialPrefs.rate);
  const [voiceProfile, setVoiceProfile] = useState<StoredVoiceProfile>(
    migrateLegacyVoiceProfile(initialPrefs.voiceProfile)
  );
  const [status, setStatus] = useState<SpeechNarrationStatus>("idle");
  const narrationPrefsRef = useRef({
    muted: initialPrefs.muted,
    rate: initialPrefs.rate,
    voiceProfile: migrateLegacyVoiceProfile(initialPrefs.voiceProfile),
  });

  useEffect(() => {
    engineRef.current = engine;
  }, [engine]);

  useEffect(() => {
    narrationPrefsRef.current = { muted, rate, voiceProfile };
  }, [muted, rate, voiceProfile]);

  const tutorialId = state.tutorial?.id ?? null;

  useEffect(() => {
    if (!state.active || !tutorialId || state.phase !== "guide") {
      if (!state.active) {
        session.stop();
        sessionKeyRef.current = null;
      }
      return;
    }

    const key = `${tutorialId}:${state.mode}`;
    if (sessionKeyRef.current === key && session.isRunning()) return;

    sessionKeyRef.current = key;
    const currentEngine = engineRef.current;
    const clips = buildPlaylist(currentEngine);
    const startIndex = Math.max(0, Math.min(currentEngine.state.stepIndex, clips.length - 1));
    const prefs = narrationPrefsRef.current;

    void session.start(
      clips,
      {
        voice: prefs.voiceProfile,
        rate: prefs.rate,
        muted: prefs.muted,
        startIndex,
      },
      {
        onStep: (stepIndex) => {
          engineRef.current.syncStepFromNarration(stepIndex);
        },
        onComplete: () => {
          engineRef.current.completeFromNarration();
        },
        onStatus: setStatus,
      }
    );
  }, [state.active, tutorialId, state.phase, state.mode, session]);

  useEffect(() => {
    if (!state.active || state.phase !== "guide") return;
    if (state.paused) session.pause();
    else session.resume();
  }, [state.paused, state.active, state.phase, session]);

  useEffect(() => {
    return () => {
      session.stop();
    };
  }, [session]);

  if (!state.active || !state.tutorial || !state.step) return null;

  const rect = state.targetRect;
  const reduced = prefersReducedMotion();
  const showSpotlight = Boolean(rect) && !state.targetMissing && state.phase === "guide";
  const caption =
    state.step.caption ||
    state.step.body ||
    (state.targetMissing
      ? "Este control no está disponible en tu vista o perfil. Seguimos con el recorrido."
      : null);

  const pad = 6;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" aria-live="polite">
      {state.phase === "intro" ? (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px]">
          <div className="mx-4 max-w-md rounded-2xl bg-[var(--surface-card,white)] p-6 text-center shadow-xl ring-1 ring-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
              Demostración · {BRAND_NAME}
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">{state.tutorial.title}</h2>
            <p className="mt-2 text-sm text-slate-600">
              Recorrido guiado con datos ficticios. No se crean ni modifican registros reales.
            </p>
            <button
              type="button"
              className="mt-4 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white"
              onClick={skipIntro}
            >
              Empezar
            </button>
          </div>
        </div>
      ) : null}

      {state.phase === "guide" ? (
        <>
          <div
            className={cn(
              "absolute inset-0 bg-slate-950/45",
              !reduced && "transition-opacity duration-300"
            )}
            style={
              showSpotlight && rect
                ? {
                    clipPath: `polygon(
                      0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
                      ${rect.left - pad}px ${rect.top - pad}px,
                      ${rect.left - pad}px ${rect.bottom + pad}px,
                      ${rect.right + pad}px ${rect.bottom + pad}px,
                      ${rect.right + pad}px ${rect.top - pad}px,
                      ${rect.left - pad}px ${rect.top - pad}px
                    )`,
                  }
                : undefined
            }
          />
          {showSpotlight && rect ? (
            <div
              className={cn(
                "absolute z-[61] rounded-xl ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-transparent",
                !reduced && "transition-all duration-300"
              )}
              style={{
                left: rect.left - pad,
                top: rect.top - pad,
                width: rect.width + pad * 2,
                height: rect.height + pad * 2,
              }}
            />
          ) : null}
          <TutorialCursor
            rect={rect}
            visible={Boolean(showSpotlight && state.step.animation?.cursor !== false)}
          />
          <TutorialPlaybackBar
            title={state.step.title}
            caption={caption}
            stepIndex={state.stepIndex}
            totalSteps={state.tutorial.steps.length}
            paused={state.paused || status === "paused"}
            muted={muted}
            rate={rate}
            voiceProfile={voiceProfile}
            onTogglePause={() => {
              if (state.paused) resume();
              else pause();
            }}
            onToggleMute={() => {
              const next = !muted;
              setMuted(next);
              session.setMuted(next);
              writeNarrationPreferences({
                muted: next,
                rate,
                voiceProfile,
              });
            }}
            onRateChange={(nextRate) => {
              const clamped = clampNarrationRate(nextRate);
              setRate(clamped);
              session.setRate(clamped);
              writeNarrationPreferences({
                muted,
                rate: clamped,
                voiceProfile,
              });
            }}
            onVoiceProfileChange={(profile) => {
              const next = migrateLegacyVoiceProfile(profile);
              setVoiceProfile(next);
              void session.setVoice(next);
              writeNarrationPreferences({
                muted,
                rate,
                voiceProfile: next,
              });
            }}
            onClose={skip}
          />
        </>
      ) : null}
    </div>
  );
}

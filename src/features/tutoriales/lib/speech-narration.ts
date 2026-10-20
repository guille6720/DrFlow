/**
 * Browser Web Speech API narration for Tutoriales NexClinic (fallback).
 * Prefers male Spanish voices to match Kokoro Alex / Santa.
 */

import {
  migrateLegacyVoiceProfile,
  type NarrationVoiceProfileId,
  pickVoiceForProfile,
} from "@/features/tutoriales/lib/voice-profiles";

export type SpeechNarrationStatus = "idle" | "speaking" | "paused" | "unsupported";
export type StoredVoiceProfile = NarrationVoiceProfileId;

export interface NarrationPreferences {
  muted: boolean;
  rate: number;
  voiceProfile: StoredVoiceProfile;
}

export const NARRATION_PREF_KEY = "nexclinic.tutoriales.narration.v2";
const NARRATION_PREF_KEY_V1 = "nexclinic.tutoriales.narration.v1";

export const DEFAULT_NARRATION_PREFS: NarrationPreferences = {
  muted: false,
  rate: 1,
  voiceProfile: "alex",
};

export function clampNarrationRate(rate: number): number {
  if (!Number.isFinite(rate)) return 1;
  return Math.min(1.35, Math.max(0.7, rate));
}

export function isSpeechSynthesisSupported(
  synth: SpeechSynthesis | undefined | null = typeof window !== "undefined"
    ? window.speechSynthesis
    : null
): boolean {
  return Boolean(synth && typeof SpeechSynthesisUtterance !== "undefined");
}

export function readNarrationPreferences(): NarrationPreferences {
  if (typeof window === "undefined") return { ...DEFAULT_NARRATION_PREFS };
  try {
    const raw =
      window.localStorage.getItem(NARRATION_PREF_KEY) ??
      window.localStorage.getItem(NARRATION_PREF_KEY_V1);
    if (!raw) return { ...DEFAULT_NARRATION_PREFS };
    const parsed = JSON.parse(raw) as Partial<NarrationPreferences>;
    return {
      muted: Boolean(parsed.muted),
      rate: clampNarrationRate(Number(parsed.rate ?? 1)),
      voiceProfile: migrateLegacyVoiceProfile(parsed.voiceProfile),
    };
  } catch {
    return { ...DEFAULT_NARRATION_PREFS };
  }
}

export function writeNarrationPreferences(prefs: NarrationPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      NARRATION_PREF_KEY,
      JSON.stringify({
        muted: prefs.muted,
        rate: clampNarrationRate(prefs.rate),
        voiceProfile: migrateLegacyVoiceProfile(prefs.voiceProfile),
      })
    );
  } catch {
    // ignore
  }
}

type StatusListener = (status: SpeechNarrationStatus) => void;

export class SpeechNarrationEngine {
  private synth: SpeechSynthesis | null =
    typeof window !== "undefined" ? window.speechSynthesis : null;
  private status: SpeechNarrationStatus = "idle";
  private listeners = new Set<StatusListener>();
  private generation = 0;
  private rate = 1;
  private muted = false;
  private voiceProfile: StoredVoiceProfile = "alex";
  private voices: SpeechSynthesisVoice[] = [];
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  getStatus(): SpeechNarrationStatus {
    return this.status;
  }

  isSupported(): boolean {
    return this.status !== "unsupported" && isSpeechSynthesisSupported(this.synth);
  }

  setRate(rate: number): void {
    this.rate = clampNarrationRate(rate);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.stop();
  }

  setVoiceProfile(profile: StoredVoiceProfile): void {
    this.voiceProfile = migrateLegacyVoiceProfile(profile);
  }

  async ensureVoices(): Promise<void> {
    if (!this.synth) {
      this.setStatus("unsupported");
      return;
    }
    const load = () => {
      this.voices = this.synth?.getVoices() ?? [];
    };
    load();
    if (this.voices.length === 0) {
      await new Promise<void>((resolve) => {
        const onVoices = () => {
          load();
          this.synth?.removeEventListener("voiceschanged", onVoices);
          resolve();
        };
        this.synth?.addEventListener("voiceschanged", onVoices);
        setTimeout(() => {
          this.synth?.removeEventListener("voiceschanged", onVoices);
          load();
          resolve();
        }, 400);
      });
    }
  }

  speak(text: string): Promise<"ended" | "stopped" | "muted" | "unsupported" | "error"> {
    if (this.muted) return Promise.resolve("muted");
    if (!this.synth || !isSpeechSynthesisSupported(this.synth)) {
      this.setStatus("unsupported");
      return Promise.resolve("unsupported");
    }
    this.generation += 1;
    const gen = this.generation;
    this.synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-AR";
    utterance.rate = this.rate;
    utterance.pitch = 1;
    // Alex / Santa are male — prefer male Spanish browser voices when falling back.
    const voice = pickVoiceForProfile(this.voices, "es-AR", this.voiceProfile === "santa");
    if (voice) utterance.voice = voice;
    this.currentUtterance = utterance;
    this.setStatus("speaking");

    return new Promise((resolve) => {
      utterance.onend = () => {
        if (gen !== this.generation) {
          resolve("stopped");
          return;
        }
        this.currentUtterance = null;
        this.setStatus("idle");
        resolve("ended");
      };
      utterance.onerror = () => {
        if (gen !== this.generation) {
          resolve("stopped");
          return;
        }
        this.currentUtterance = null;
        this.setStatus("idle");
        resolve("error");
      };
      try {
        this.synth!.speak(utterance);
      } catch {
        this.setStatus("idle");
        resolve("error");
      }
    });
  }

  pause(): void {
    if (!this.synth || this.status !== "speaking") return;
    this.synth.pause();
    this.setStatus("paused");
  }

  resume(): void {
    if (!this.synth || this.status !== "paused") return;
    this.synth.resume();
    this.setStatus("speaking");
  }

  stop(): void {
    this.generation += 1;
    this.currentUtterance = null;
    try {
      this.synth?.cancel();
    } catch {
      // ignore
    }
    this.setStatus("idle");
  }

  private setStatus(status: SpeechNarrationStatus): void {
    this.status = status;
    for (const listener of this.listeners) listener(status);
  }
}

let singleton: SpeechNarrationEngine | null = null;

export function getSpeechNarrationEngine(): SpeechNarrationEngine {
  if (!singleton) singleton = new SpeechNarrationEngine();
  return singleton;
}

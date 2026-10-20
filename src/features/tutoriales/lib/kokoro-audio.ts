/**
 * Client player for pre-generated Kokoro tutorial narration (static WAV assets).
 * No model load, no API keys. Missing clips fall through to browser TTS.
 */

import {
  loadKokoroManifest,
  resolveKokoroAudioUrl,
} from "@/features/tutoriales/lib/kokoro-manifest";
import type { SpeechNarrationStatus } from "@/features/tutoriales/lib/speech-narration";
import type { NarrationVoiceProfileId } from "@/features/tutoriales/lib/voice-profiles";
import { normalizeSpokenText } from "@/features/tutoriales/spoken-text";

export type KokoroSpeakResult = "ended" | "stopped" | "muted" | "missing" | "error";

function clampPlaybackRate(rate: number): number {
  if (!Number.isFinite(rate)) return 1;
  return Math.min(1.25, Math.max(0.8, rate));
}

export class KokoroAudioEngine {
  private audio: HTMLAudioElement | null = null;
  private status: SpeechNarrationStatus = "idle";
  private muted = false;
  private rate = 1;
  private generation = 0;
  private ready: boolean | null = null;
  private listeners = new Set<(status: SpeechNarrationStatus) => void>();
  private prefetchCache = new Set<string>();

  getStatus(): SpeechNarrationStatus {
    return this.status;
  }

  subscribe(listener: (status: SpeechNarrationStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.stop();
  }

  setRate(rate: number): void {
    this.rate = clampPlaybackRate(rate);
    if (this.audio) this.audio.playbackRate = this.rate;
  }

  async isAvailable(): Promise<boolean> {
    // Always re-check: tests and HMR may swap the injected manifest.
    const manifest = await loadKokoroManifest();
    this.ready = Boolean(manifest?.clips?.length);
    return this.ready;
  }

  async prefetch(text: string, voice: NarrationVoiceProfileId): Promise<boolean> {
    if (typeof window === "undefined" || this.muted) return false;
    const spoken = normalizeSpokenText(text.trim());
    if (!spoken) return false;
    const url = await resolveKokoroAudioUrl(spoken, voice);
    if (!url) return false;
    const key = `${voice}::${url}`;
    if (this.prefetchCache.has(key)) return true;
    try {
      const response = await fetch(url, { cache: "force-cache" });
      if (!response.ok) return false;
      this.prefetchCache.add(key);
      return true;
    } catch {
      return false;
    }
  }

  async speak(text: string, voice: NarrationVoiceProfileId): Promise<KokoroSpeakResult> {
    if (typeof window === "undefined") return "error";
    if (this.muted) {
      this.setStatus("idle");
      return "muted";
    }

    const spoken = normalizeSpokenText(text.trim());
    if (!spoken) return "missing";

    const generation = ++this.generation;
    this.setStatus("speaking");

    const url = await resolveKokoroAudioUrl(spoken, voice);
    if (generation !== this.generation) return "stopped";
    if (!url) {
      this.setStatus("idle");
      return "missing";
    }

    this.detachCurrentAudio();
    const audio = new Audio(url);
    audio.playbackRate = this.rate;
    this.audio = audio;

    return await new Promise<KokoroSpeakResult>((resolve) => {
      audio.onended = () => {
        if (generation !== this.generation) {
          resolve("stopped");
          return;
        }
        this.setStatus("idle");
        resolve("ended");
      };
      audio.onerror = () => {
        if (generation !== this.generation) {
          resolve("stopped");
          return;
        }
        this.setStatus("idle");
        resolve("error");
      };
      void audio.play().catch(() => {
        if (generation !== this.generation) {
          resolve("stopped");
          return;
        }
        this.setStatus("idle");
        resolve("error");
      });
    });
  }

  pause(): void {
    if (!this.audio || this.status !== "speaking") return;
    this.audio.pause();
    this.setStatus("paused");
  }

  resume(): void {
    if (!this.audio || this.status !== "paused") return;
    void this.audio.play().then(() => this.setStatus("speaking"));
  }

  stop(): void {
    this.generation += 1;
    this.detachCurrentAudio();
    this.setStatus("idle");
  }

  private detachCurrentAudio(): void {
    if (this.audio) {
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
      this.audio = null;
    }
  }

  private setStatus(status: SpeechNarrationStatus): void {
    this.status = status;
    for (const listener of this.listeners) listener(status);
  }
}

let singleton: KokoroAudioEngine | null = null;

export function getKokoroAudioEngine(): KokoroAudioEngine {
  if (!singleton) singleton = new KokoroAudioEngine();
  return singleton;
}

/**
 * Client-side player for ElevenLabs tutorial narration (via /api/tutoriales/tts).
 */

import type { SpeechNarrationStatus } from "@/features/tutoriales/lib/speech-narration";
import type { NarrationVoiceProfileId } from "@/features/tutoriales/lib/voice-profiles";
import { normalizeSpokenText } from "@/features/tutoriales/spoken-text";

export interface ElevenLabsSpeakOptions {
  rate?: number;
  volume?: number;
  onEnd?: () => void;
  onError?: (error: unknown) => void;
}

function clampPlaybackRate(rate: number): number {
  if (!Number.isFinite(rate)) return 1;
  return Math.min(1.25, Math.max(0.8, rate));
}

function cacheKey(voiceProfile: NarrationVoiceProfileId, text: string): string {
  return `${voiceProfile}::${text}`;
}

export class ElevenLabsAudioEngine {
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  private status: SpeechNarrationStatus = "idle";
  private muted = false;
  private rate = 1;
  private generation = 0;
  private configured: boolean | null = null;
  private listeners = new Set<(status: SpeechNarrationStatus) => void>();
  private cache = new Map<string, Blob>();
  private inflight = new Map<string, Promise<Blob | null>>();

  getStatus(): SpeechNarrationStatus {
    return this.status;
  }

  isMuted(): boolean {
    return this.muted;
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
    if (this.configured != null) return this.configured;
    if (typeof window === "undefined") {
      this.configured = false;
      return false;
    }
    try {
      const response = await fetch("/api/tutoriales/tts", {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) {
        this.configured = false;
        return false;
      }
      const data = (await response.json()) as { configured?: boolean };
      this.configured = Boolean(data.configured);
      return this.configured;
    } catch {
      this.configured = false;
      return false;
    }
  }

  async prefetch(text: string, voiceProfile: NarrationVoiceProfileId): Promise<boolean> {
    if (typeof window === "undefined" || this.muted) return false;
    const spoken = normalizeSpokenText(text.trim());
    if (!spoken) return false;
    const blob = await this.fetchBlob(spoken, voiceProfile);
    return Boolean(blob);
  }

  async speak(
    text: string,
    voiceProfile: NarrationVoiceProfileId,
    options: ElevenLabsSpeakOptions = {}
  ): Promise<"ended" | "stopped" | "muted" | "error"> {
    if (typeof window === "undefined") return "error";
    if (this.muted) {
      this.setStatus("idle");
      return "muted";
    }

    const spoken = normalizeSpokenText(text.trim());
    if (!spoken) return "error";

    const generation = ++this.generation;
    this.setStatus("speaking");

    try {
      const blob = await this.fetchBlob(spoken, voiceProfile);
      if (generation !== this.generation) return "stopped";

      if (!blob) {
        this.setStatus("idle");
        options.onError?.(new Error("Sin audio ElevenLabs"));
        return "error";
      }

      this.detachCurrentAudio();
      this.revokeObjectUrl();
      this.objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(this.objectUrl);
      audio.playbackRate = clampPlaybackRate(options.rate ?? this.rate);
      if (typeof options.volume === "number") {
        audio.volume = Math.min(1, Math.max(0, options.volume));
      }
      this.audio = audio;

      return await new Promise<"ended" | "stopped" | "error">((resolve) => {
        audio.onended = () => {
          if (generation !== this.generation) {
            resolve("stopped");
            return;
          }
          this.setStatus("idle");
          options.onEnd?.();
          resolve("ended");
        };
        audio.onerror = () => {
          if (generation !== this.generation) {
            resolve("stopped");
            return;
          }
          this.setStatus("idle");
          options.onError?.(new Error("Error de reproducción ElevenLabs"));
          resolve("error");
        };
        void audio.play().catch((error) => {
          if (generation !== this.generation) {
            resolve("stopped");
            return;
          }
          this.setStatus("idle");
          options.onError?.(error);
          resolve("error");
        });
      });
    } catch (error) {
      if (generation === this.generation) {
        this.setStatus("idle");
        options.onError?.(error);
      }
      return generation === this.generation ? "error" : "stopped";
    }
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
    this.revokeObjectUrl();
    this.setStatus("idle");
  }

  private async fetchBlob(
    spoken: string,
    voiceProfile: NarrationVoiceProfileId
  ): Promise<Blob | null> {
    const key = cacheKey(voiceProfile, spoken);
    const cached = this.cache.get(key);
    if (cached) return cached;

    const existing = this.inflight.get(key);
    if (existing) return existing;

    const request = (async () => {
      try {
        const response = await fetch("/api/tutoriales/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: spoken, voiceProfile }),
        });

        if (response.status === 503 || response.status === 404) {
          this.configured = false;
          return null;
        }
        if (!response.ok) return null;

        this.configured = true;
        const blob = await response.blob();
        if (blob.size > 0) {
          this.cache.set(key, blob);
          if (this.cache.size > 24) {
            const first = this.cache.keys().next().value;
            if (first != null) this.cache.delete(first);
          }
        }
        return blob;
      } catch {
        return null;
      } finally {
        this.inflight.delete(key);
      }
    })();

    this.inflight.set(key, request);
    return request;
  }

  private detachCurrentAudio(): void {
    if (this.audio) {
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio.pause();
      this.audio.src = "";
      this.audio = null;
    }
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  private setStatus(status: SpeechNarrationStatus): void {
    this.status = status;
    for (const listener of this.listeners) listener(status);
  }
}

let singleton: ElevenLabsAudioEngine | null = null;

export function getElevenLabsAudioEngine(): ElevenLabsAudioEngine {
  if (!singleton) singleton = new ElevenLabsAudioEngine();
  return singleton;
}

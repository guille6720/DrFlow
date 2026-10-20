/**
 * Audio-driven continuous tutorial narration.
 * Prefers offline Kokoro WAV assets (Alex / Santa); falls back to male browser TTS.
 */

import { getKokoroAudioEngine } from "@/features/tutoriales/lib/kokoro-audio";
import {
  getSpeechNarrationEngine,
  type SpeechNarrationStatus,
  type StoredVoiceProfile,
} from "@/features/tutoriales/lib/speech-narration";
import { normalizeSpokenText } from "@/features/tutoriales/spoken-text";

export interface ContinuousNarrationClip {
  stepIndex: number;
  text: string;
  clipId: string;
}

export interface ContinuousNarrationHandlers {
  onStep: (stepIndex: number) => void;
  onComplete: () => void;
  onStatus?: (status: SpeechNarrationStatus) => void;
}

function estimateHoldMs(text: string): number {
  return Math.min(45_000, Math.max(2_500, text.trim().length * 55));
}

export class ContinuousNarrationSession {
  private clips: ContinuousNarrationClip[] = [];
  private index = -1;
  private voice: StoredVoiceProfile = "alex";
  private rate = 1;
  private muted = false;
  private paused = false;
  private running = false;
  private generation = 0;
  private handlers: ContinuousNarrationHandlers | null = null;
  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private useKokoro = true;
  private kokoro = getKokoroAudioEngine();
  private browser = getSpeechNarrationEngine();
  private unsub: (() => void) | null = null;

  isRunning(): boolean {
    return this.running;
  }

  getStatus(): SpeechNarrationStatus {
    if (!this.running) return "idle";
    if (this.paused) return "paused";
    if (this.muted) return "idle";
    return this.useKokoro ? this.kokoro.getStatus() : this.browser.getStatus();
  }

  async start(
    clips: ContinuousNarrationClip[],
    options: {
      voice: StoredVoiceProfile;
      rate: number;
      muted?: boolean;
      startIndex?: number;
    },
    handlers: ContinuousNarrationHandlers
  ): Promise<void> {
    this.stopInternal(false);
    const cleaned = clips
      .map((clip) => ({
        ...clip,
        text: normalizeSpokenText(clip.text.trim()),
      }))
      .filter((clip) => clip.text.length > 0);
    if (cleaned.length === 0) {
      handlers.onComplete();
      return;
    }

    this.clips = cleaned;
    this.voice = options.voice;
    this.rate = options.rate;
    this.muted = Boolean(options.muted);
    this.paused = false;
    this.running = true;
    this.handlers = handlers;
    this.index = Math.max(0, Math.min(options.startIndex ?? 0, cleaned.length - 1));
    this.generation += 1;
    const gen = this.generation;

    this.useKokoro = await this.kokoro.isAvailable();
    if (gen !== this.generation || !this.running) return;

    if (this.useKokoro) {
      this.kokoro.setRate(this.rate);
      this.kokoro.setMuted(this.muted);
      this.unsub = this.kokoro.subscribe((status) => {
        handlers.onStatus?.(this.paused ? "paused" : status);
      });
      const first = cleaned[this.index];
      if (first) {
        await this.kokoro.prefetch(first.text, this.voice);
      }
      if (gen !== this.generation || !this.running) return;
      void this.prefetchFrom(this.index + 1, gen);
    } else {
      this.browser.setRate(this.rate);
      this.browser.setVoiceProfile(this.voice);
      this.browser.setMuted(this.muted);
      this.unsub = this.browser.subscribe((status) => {
        handlers.onStatus?.(this.paused ? "paused" : status);
      });
      await this.browser.ensureVoices();
      if (gen !== this.generation || !this.running) return;
    }

    await this.playIndex(this.index, gen);
  }

  pause(): void {
    if (!this.running || this.paused) return;
    this.paused = true;
    if (this.holdTimer != null) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    if (this.useKokoro) this.kokoro.pause();
    else this.browser.pause();
    this.handlers?.onStatus?.("paused");
  }

  resume(): void {
    if (!this.running || !this.paused) return;
    this.paused = false;
    if (this.muted) {
      void this.scheduleMutedHold(this.generation);
      return;
    }
    const status = this.useKokoro ? this.kokoro.getStatus() : this.browser.getStatus();
    if (status === "paused") {
      if (this.useKokoro) this.kokoro.resume();
      else this.browser.resume();
      this.handlers?.onStatus?.("speaking");
      return;
    }
    void this.playIndex(this.index, this.generation);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.kokoro.setMuted(muted);
    this.browser.setMuted(muted);
    if (!this.running || this.paused) return;
    if (muted) {
      this.kokoro.stop();
      this.browser.stop();
      void this.scheduleMutedHold(this.generation);
    } else {
      void this.playIndex(this.index, this.generation);
    }
  }

  setRate(rate: number): void {
    this.rate = rate;
    this.kokoro.setRate(rate);
    this.browser.setRate(rate);
  }

  async setVoice(voice: StoredVoiceProfile): Promise<void> {
    this.voice = voice;
    this.browser.setVoiceProfile(voice);
    if (!this.running || this.paused || this.muted) return;
    this.kokoro.stop();
    this.browser.stop();
    if (this.useKokoro) {
      const remaining = this.clips.slice(this.index);
      await Promise.all(remaining.map((clip) => this.kokoro.prefetch(clip.text, voice)));
    }
    await this.playIndex(this.index, this.generation);
  }

  stop(): void {
    this.stopInternal(true);
  }

  private stopInternal(_notifyIdle: boolean): void {
    this.generation += 1;
    this.running = false;
    this.paused = false;
    if (this.holdTimer != null) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    this.kokoro.stop();
    this.browser.stop();
    this.unsub?.();
    this.unsub = null;
    this.handlers = null;
    this.clips = [];
    this.index = -1;
  }

  private async prefetchFrom(startIndex: number, gen: number): Promise<void> {
    if (!this.useKokoro) return;
    for (let i = startIndex; i < this.clips.length; i += 1) {
      if (gen !== this.generation || !this.running) return;
      const clip = this.clips[i];
      if (!clip) continue;
      await this.kokoro.prefetch(clip.text, this.voice);
    }
  }

  private async playIndex(index: number, gen: number): Promise<void> {
    if (gen !== this.generation || !this.running || this.paused) return;
    const clip = this.clips[index];
    if (!clip) {
      this.running = false;
      this.handlers?.onComplete();
      return;
    }
    this.index = index;
    this.handlers?.onStep(clip.stepIndex);
    void this.prefetchFrom(index + 1, gen);

    if (this.muted) {
      await this.scheduleMutedHold(gen);
      return;
    }

    if (this.useKokoro) {
      const result = await this.kokoro.speak(clip.text, this.voice);
      if (gen !== this.generation || !this.running || this.paused) return;
      if (result === "ended") {
        await this.advance(gen);
        return;
      }
      if (result === "missing" || result === "error" || result === "muted") {
        await this.speakWithBrowserAndAdvance(clip.text, gen, result === "muted");
        return;
      }
      return;
    }

    await this.speakWithBrowserAndAdvance(clip.text, gen, false);
  }

  private async speakWithBrowserAndAdvance(
    text: string,
    gen: number,
    alreadyMuted: boolean
  ): Promise<void> {
    if (alreadyMuted) {
      await this.scheduleMutedHold(gen, true);
      return;
    }
    const result = await this.browser.speak(text);
    if (gen !== this.generation || !this.running || this.paused) return;
    if (result === "ended" || result === "muted") {
      await this.advance(gen);
      return;
    }
    if (result === "unsupported" || result === "error") {
      await this.scheduleMutedHold(gen, true);
    }
  }

  private async scheduleMutedHold(gen: number, fromFallback = false): Promise<void> {
    if (gen !== this.generation || !this.running || this.paused) return;
    const clip = this.clips[this.index];
    if (!clip) {
      this.running = false;
      this.handlers?.onComplete();
      return;
    }
    if (!fromFallback && !this.muted) return;
    const ms = estimateHoldMs(clip.text);
    await new Promise<void>((resolve) => {
      this.holdTimer = setTimeout(() => {
        this.holdTimer = null;
        resolve();
      }, ms);
    });
    if (gen !== this.generation || !this.running || this.paused) return;
    await this.advance(gen);
  }

  private async advance(gen: number): Promise<void> {
    if (gen !== this.generation || !this.running || this.paused) return;
    const next = this.index + 1;
    if (next >= this.clips.length) {
      this.running = false;
      this.handlers?.onComplete();
      return;
    }
    await this.playIndex(next, gen);
  }
}

let sessionSingleton: ContinuousNarrationSession | null = null;

export function getContinuousNarrationSession(): ContinuousNarrationSession {
  if (!sessionSingleton) sessionSingleton = new ContinuousNarrationSession();
  return sessionSingleton;
}

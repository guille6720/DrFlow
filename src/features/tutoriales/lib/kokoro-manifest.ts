import type { NarrationVoiceProfileId } from "@/features/tutoriales/lib/voice-profiles";
import { normalizeSpokenText } from "@/features/tutoriales/spoken-text";

export interface KokoroManifestClip {
  textHash: string;
  text: string;
  files: Partial<Record<NarrationVoiceProfileId, string>>;
}

export interface KokoroManifest {
  version: number;
  engine: string;
  sampleRate: number;
  voices: Array<{ id: NarrationVoiceProfileId; kokoroId: string; label: string }>;
  clips: KokoroManifestClip[];
}

let cached: KokoroManifest | null = null;
let byHash: Map<string, KokoroManifestClip> | null = null;
let loadPromise: Promise<KokoroManifest | null> | null = null;

function bytesToHex16(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

/** Same 16-char hex prefix as scripts/tutoriales/extract-narration-clips.mjs */
export async function hashNarrationTextHex(text: string): Promise<string> {
  const normalized = normalizeSpokenText(text.trim());
  const subtle = globalThis.crypto?.subtle;
  if (!subtle?.digest) {
    throw new Error("Web Crypto SHA-256 no disponible para hash de narración");
  }
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return bytesToHex16(digest);
}

export async function loadKokoroManifest(): Promise<KokoroManifest | null> {
  if (cached) return cached;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const response = await fetch("/tutoriales/narration/v1/manifest.json", {
        cache: "force-cache",
      });
      if (!response.ok) return null;
      const data = (await response.json()) as KokoroManifest;
      if (!data?.clips?.length) return null;
      cached = data;
      byHash = new Map(data.clips.map((clip) => [clip.textHash, clip]));
      return cached;
    } catch {
      return null;
    } finally {
      loadPromise = null;
    }
  })();
  return loadPromise;
}

export async function resolveKokoroAudioUrl(
  text: string,
  voice: NarrationVoiceProfileId
): Promise<string | null> {
  const manifest = await loadKokoroManifest();
  if (!manifest || !byHash) return null;
  const textHash = await hashNarrationTextHex(text);
  const clip = byHash.get(textHash);
  return clip?.files?.[voice] ?? null;
}

/** Test helper — inject a manifest without fetch. */
export function __setKokoroManifestForTests(manifest: KokoroManifest | null): void {
  cached = manifest;
  byHash = manifest ? new Map(manifest.clips.map((clip) => [clip.textHash, clip])) : null;
  loadPromise = null;
}

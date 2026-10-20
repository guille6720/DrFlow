import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type ContinuousNarrationClip,
  ContinuousNarrationSession,
} from "@/features/tutoriales/lib/continuous-narration-session";
import {
  __setKokoroManifestForTests,
  hashNarrationTextHex,
  type KokoroManifest,
  resolveKokoroAudioUrl,
} from "@/features/tutoriales/lib/kokoro-manifest";
import {
  migrateLegacyVoiceProfile,
  NARRATION_VOICE_LABELS,
  NARRATION_VOICE_PROFILES,
} from "@/features/tutoriales/lib/voice-profiles";
import { normalizeSpokenText } from "@/features/tutoriales/spoken-text";

function sampleManifest(): KokoroManifest {
  return {
    version: 1,
    engine: "kokoro",
    sampleRate: 24000,
    voices: [
      { id: "dora", kokoroId: "ef_dora", label: "Dora" },
      { id: "alex", kokoroId: "em_alex", label: "Alex" },
      { id: "santa", kokoroId: "em_santa", label: "Santa" },
    ],
    clips: [],
  };
}

describe("kokoro voice profiles", () => {
  it("exposes Dora, Alex and Santa (soft cordial set)", () => {
    expect([...NARRATION_VOICE_PROFILES]).toEqual(["dora", "alex", "santa"]);
    expect(NARRATION_VOICE_LABELS.dora).toBe("Dora");
    expect(NARRATION_VOICE_LABELS.alex).toBe("Alex");
    expect(NARRATION_VOICE_LABELS.santa).toBe("Santa");
    expect(migrateLegacyVoiceProfile("brian")).toBe("dora");
    expect(migrateLegacyVoiceProfile("female")).toBe("dora");
    expect(migrateLegacyVoiceProfile("horacio")).toBe("santa");
  });
});

describe("kokoro manifest lookup", () => {
  afterEach(() => {
    __setKokoroManifestForTests(null);
  });

  it("resolves hashed normalized text to voice file urls", async () => {
    const text = normalizeSpokenText("Bienvenido a NexClinic en /turnos/agenda");
    const textHash = await hashNarrationTextHex(text);
    const manifest = sampleManifest();
    manifest.clips = [
      {
        textHash,
        text,
        files: {
          dora: `/tutoriales/narration/v1/dora/${textHash}.wav`,
          alex: `/tutoriales/narration/v1/alex/${textHash}.wav`,
          santa: `/tutoriales/narration/v1/santa/${textHash}.wav`,
        },
      },
    ];
    __setKokoroManifestForTests(manifest);

    await expect(resolveKokoroAudioUrl(text, "dora")).resolves.toBe(
      `/tutoriales/narration/v1/dora/${textHash}.wav`
    );
    await expect(resolveKokoroAudioUrl(text, "alex")).resolves.toBe(
      `/tutoriales/narration/v1/alex/${textHash}.wav`
    );
  });

  it("returns null when clip is missing (browser fallback path)", async () => {
    __setKokoroManifestForTests(sampleManifest());
    await expect(resolveKokoroAudioUrl("texto inexistente", "alex")).resolves.toBeNull();
  });
});

describe("continuous narration with kokoro gaps", () => {
  afterEach(() => {
    __setKokoroManifestForTests(null);
    vi.restoreAllMocks();
  });

  it(
    "advances steps when kokoro assets are unavailable without blocking",
    async () => {
      // Empty manifest ⇒ Kokoro unavailable without network fetch.
      __setKokoroManifestForTests({ ...sampleManifest(), clips: [] });

      const clips: ContinuousNarrationClip[] = [
        { stepIndex: 0, text: "Paso uno de demostración.", clipId: "a" },
        { stepIndex: 1, text: "Paso dos de demostración.", clipId: "b" },
      ];
      const steps: number[] = [];
      let completed = false;

      const session = new ContinuousNarrationSession();
      await session.start(
        clips,
        { voice: "alex", rate: 1, muted: true, startIndex: 0 },
        {
          onStep: (index) => steps.push(index),
          onComplete: () => {
            completed = true;
          },
        }
      );

      await vi.waitFor(() => expect(completed).toBe(true), { timeout: 20_000 });
      expect(steps[0]).toBe(0);
      expect(steps.at(-1)).toBe(1);
      session.stop();
    },
    25_000
  );

  it("stop cancels pending playback generation", async () => {
    const session = new ContinuousNarrationSession();
    const done = vi.fn();
    void session.start(
      [{ stepIndex: 0, text: "Clip largo de prueba.", clipId: "x" }],
      { voice: "santa", rate: 1, muted: true },
      { onStep: () => undefined, onComplete: done }
    );
    session.stop();
    await new Promise((r) => setTimeout(r, 50));
    expect(session.isRunning()).toBe(false);
    expect(done).not.toHaveBeenCalled();
  });
});

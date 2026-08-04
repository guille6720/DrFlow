import { describe, expect, it, vi } from "vitest";
import {
  appendSpeechToTextarea,
  isVoiceInputAvailable,
  isVoiceInputEnvEnabled,
} from "@/features/voice/lib/voice-input";

describe("voice input feature flags", () => {
  it("is enabled by default via env", () => {
    vi.stubEnv("NEXT_PUBLIC_VOICE_INPUT_ENABLED", "");
    expect(isVoiceInputEnvEnabled()).toBe(true);
  });

  it("can be disabled globally via env", () => {
    vi.stubEnv("NEXT_PUBLIC_VOICE_INPUT_ENABLED", "false");
    expect(isVoiceInputEnvEnabled()).toBe(false);
    vi.unstubAllEnvs();
  });

  it("requires clinic and user prefs when gating availability", () => {
    expect(
      isVoiceInputAvailable({
        clinicEnabled: true,
        userEnabled: true,
        browserSupported: true,
      })
    ).toBe(true);
    expect(
      isVoiceInputAvailable({
        clinicEnabled: false,
        userEnabled: true,
        browserSupported: true,
      })
    ).toBe(false);
    expect(
      isVoiceInputAvailable({
        clinicEnabled: true,
        userEnabled: false,
        browserSupported: true,
      })
    ).toBe(false);
  });
});

describe("appendSpeechToTextarea", () => {
  it("appends transcript with spacing", () => {
    const el = document.createElement("textarea");
    el.value = "Paciente refiere";
    appendSpeechToTextarea(el, "dolor torácico");
    expect(el.value).toBe("Paciente refiere dolor torácico");
  });

  it("does not duplicate spaces on empty field", () => {
    const el = document.createElement("textarea");
    appendSpeechToTextarea(el, "Evolución inicial");
    expect(el.value).toBe("Evolución inicial");
  });
});

import { afterEach, describe, expect, it } from "vitest";

import {
  appendSpeechToTextarea,
  isSpeechRecognitionSupported,
  isVoiceInputAvailable,
  isVoiceInputEnvEnabled,
  readVoiceInputUserPref,
  VOICE_INPUT_USER_STORAGE_KEY,
  writeVoiceInputUserPref,
} from "@/features/voice/lib/voice-input";

describe("voice-input feature", () => {
  const envBackup = process.env.NEXT_PUBLIC_VOICE_INPUT_ENABLED;

  afterEach(() => {
    process.env.NEXT_PUBLIC_VOICE_INPUT_ENABLED = envBackup;
    localStorage.clear();
  });

  it("respects env kill switch", () => {
    delete process.env.NEXT_PUBLIC_VOICE_INPUT_ENABLED;
    expect(isVoiceInputEnvEnabled()).toBe(true);
    process.env.NEXT_PUBLIC_VOICE_INPUT_ENABLED = "false";
    expect(isVoiceInputEnvEnabled()).toBe(false);
  });

  it("reads and writes user preference", () => {
    expect(readVoiceInputUserPref()).toBe(true);
    writeVoiceInputUserPref(false);
    expect(localStorage.getItem(VOICE_INPUT_USER_STORAGE_KEY)).toBe("0");
    expect(readVoiceInputUserPref()).toBe(false);
  });

  it("combines availability flags", () => {
    expect(isVoiceInputAvailable({ clinicEnabled: false })).toBe(false);
    expect(isVoiceInputAvailable({ userEnabled: false })).toBe(false);
    expect(isVoiceInputAvailable({})).toBe(true);
  });

  it("detects speech recognition support", () => {
    expect(typeof isSpeechRecognitionSupported()).toBe("boolean");
  });

  it("appends transcript to textarea", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "Hola";
    appendSpeechToTextarea(textarea, "mundo");
    expect(textarea.value).toBe("Hola mundo");
  });
});

export const VOICE_INPUT_USER_STORAGE_KEY = "drflow-voice-input-enabled";

/** Kill switch global (deploy). Por defecto activo; poner "false" para desactivar en toda la app. */
export function isVoiceInputEnvEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_VOICE_INPUT_ENABLED;
  if (raw == null || raw === "") return true;
  return raw !== "false" && raw !== "0";
}

export function readVoiceInputUserPref(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(VOICE_INPUT_USER_STORAGE_KEY);
    if (raw === "0") return false;
    if (raw === "1") return true;
    return true;
  } catch {
    return true;
  }
}

export function writeVoiceInputUserPref(enabled: boolean) {
  try {
    localStorage.setItem(VOICE_INPUT_USER_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* private mode */
  }
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
      .SpeechRecognition ||
      (window as Window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  );
}

export function isVoiceInputAvailable(options: {
  clinicEnabled?: boolean | null;
  userEnabled?: boolean;
  browserSupported?: boolean;
}): boolean {
  if (!isVoiceInputEnvEnabled()) return false;
  if (options.clinicEnabled === false) return false;
  if (options.userEnabled === false) return false;
  if (options.browserSupported === false) return false;
  return true;
}

export function appendSpeechToTextarea(textarea: HTMLTextAreaElement, transcript: string) {
  const chunk = transcript.trim();
  if (!chunk) return;

  const current = textarea.value;
  const needsSpace =
    current.length > 0 && !current.endsWith(" ") && !current.endsWith("\n");
  textarea.value = current + (needsSpace ? " " : "") + chunk;

  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));
  textarea.focus();
}

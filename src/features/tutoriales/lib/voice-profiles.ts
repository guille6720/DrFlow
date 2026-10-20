/**
 * Browser Web Speech voice helpers (fallback only).
 * Tutoriales primary voices are offline Kokoro em_alex / em_santa.
 */

/** Strong female cues only — avoid broad matches like "Google español". */
const FEMALE_VOICE_HINTS =
  /\b(female|mujer|femenin[oa]?|sabina|m[oó]nica|paulina|helena|elena|luc[ií]a|sof[ií]a|mar[ií]a|carmen|isabela|paloma|dalia|zira|elsa|pilar|conchita|linda|laura|sara|joanna|ivy|salli|kendra|kimberly|amy|emma|olivia|hedda|katja|susan|hazel|catherine)\b/i;

/** Strong male cues only. */
const MALE_VOICE_HINTS =
  /\b(male|hombre|masculin[oa]?|pablo|jorge|diego|ra[uú]l|tom[aá]s|tomas|carlos|enrique|miguel|antonio|juan|pedro|david|mark|matthew|justin|joey|brian|arthur|george|james|ravi|raul|alvaro|álvaro|javi|javier|alex|santa)\b/i;

export type BrowserVoiceGender = "female" | "male" | "unknown";
/** UI / player voice ids (Kokoro: em_alex, em_santa). */
export type NarrationVoiceProfileId = "alex" | "santa";

export const NARRATION_VOICE_PROFILES: readonly NarrationVoiceProfileId[] = ["alex", "santa"];

export const NARRATION_VOICE_LABELS: Record<NarrationVoiceProfileId, string> = {
  alex: "Alex",
  santa: "Santa",
};

export const KOKORO_VOICE_IDS: Record<NarrationVoiceProfileId, string> = {
  alex: "em_alex",
  santa: "em_santa",
};

export function migrateLegacyVoiceProfile(value: unknown): NarrationVoiceProfileId {
  if (value === "alex" || value === "santa") return value;
  // Legacy ElevenLabs / browser labels → Kokoro Spanish male voices.
  if (value === "horacio" || value === "browser-es-alt" || value === "female") return "santa";
  return "alex";
}

export function classifySpeechVoiceGender(
  voice: Pick<SpeechSynthesisVoice, "name" | "voiceURI">
): BrowserVoiceGender {
  const haystack = `${voice.name} ${voice.voiceURI}`;
  const female = FEMALE_VOICE_HINTS.test(haystack);
  const male = MALE_VOICE_HINTS.test(haystack);
  if (female && !male) return "female";
  if (male && !female) return "male";
  return "unknown";
}

export function isSpanishVoice(voice: Pick<SpeechSynthesisVoice, "lang">): boolean {
  const lang = voice.lang.toLowerCase().replace("_", "-");
  return lang === "es" || lang.startsWith("es-");
}

export function listSpanishVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return voices.filter(isSpanishVoice);
}

export function scoreSpanishVoiceQuality(
  voice: SpeechSynthesisVoice,
  preferredLang = "es-AR"
): number {
  const name = `${voice.name} ${voice.voiceURI}`;
  const lang = voice.lang.toLowerCase().replace("_", "-");
  const preferred = preferredLang.toLowerCase().replace("_", "-");
  let score = 0;

  if (/natural|neural|online|premium|enhanced/i.test(name)) score += 120;
  if (/google/i.test(name)) score += 55;
  if (!voice.localService) score += 40;
  if (/desktop|compact|mobile|hepspeak|espeak/i.test(name)) score -= 55;

  if (lang === preferred) score += 60;
  else if (lang.startsWith("es-ar")) score += 55;
  else if (lang.startsWith("es-mx")) score += 40;
  else if (lang.startsWith("es-us")) score += 30;
  else if (lang.startsWith("es-es") || lang === "es") score += 20;

  if (MALE_VOICE_HINTS.test(name)) score += 30;
  if (FEMALE_VOICE_HINTS.test(name)) score -= 40;

  return score;
}

/**
 * Browser fallback voice picker (male Spanish).
 * `alt` picks the second-best male voice when available (Santa fallback).
 */
export function pickVoiceForProfile(
  voices: SpeechSynthesisVoice[],
  preferredLang = "es-AR",
  alt = false
): SpeechSynthesisVoice | null {
  const spanish = listSpanishVoices(voices);
  const pool = spanish.length ? spanish : voices;
  if (!pool.length) return null;

  const males = pool.filter((voice) => classifySpeechVoiceGender(voice) === "male");
  if (!males.length) return null;
  const ranked = [...males].sort(
    (a, b) => scoreSpanishVoiceQuality(b, preferredLang) - scoreSpanishVoiceQuality(a, preferredLang)
  );
  if (alt && ranked.length > 1) return ranked[1] ?? ranked[0] ?? null;
  return ranked[0] ?? null;
}

export const VOICE_PREVIEW_SAMPLE =
  "Hola. Así se escucha la narración de Tutoriales Nex Clinic para cada módulo.";

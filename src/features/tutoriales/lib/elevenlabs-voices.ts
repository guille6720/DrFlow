import type { NarrationVoiceProfileId } from "@/features/tutoriales/lib/voice-profiles";

/**
 * ElevenLabs Voice Library IDs for Tutoriales NexClinic.
 * Same Brian C / Horacio voices as the SyncVete tutorials worktree.
 * Override with ELEVENLABS_VOICE_BRIAN_ID / ELEVENLABS_VOICE_HORACIO_ID if needed.
 */
export const ELEVENLABS_VOICE_IDS: Record<NarrationVoiceProfileId, string> = {
  brian: process.env.ELEVENLABS_VOICE_BRIAN_ID?.trim() || "XgQWNZcJ8SRkxXwwhPTo",
  horacio: process.env.ELEVENLABS_VOICE_HORACIO_ID?.trim() || "57D8YIbQSuE3REDPO6Vm",
};

export const ELEVENLABS_MODEL_ID =
  process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_multilingual_v2";

export function resolveElevenLabsVoiceId(profile: NarrationVoiceProfileId): string {
  return ELEVENLABS_VOICE_IDS[profile];
}

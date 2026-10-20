/**
 * Server-side ElevenLabs TTS for Tutoriales NexClinic.
 * Never expose the API key to the browser. No SyncVete upstream relay.
 */

import {
  ELEVENLABS_MODEL_ID,
  resolveElevenLabsVoiceId,
} from "@/features/tutoriales/lib/elevenlabs-voices";
import type { NarrationVoiceProfileId } from "@/features/tutoriales/lib/voice-profiles";

const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";

export function isElevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

export async function synthesizeElevenLabsSpeech(options: {
  text: string;
  voiceProfile: NarrationVoiceProfileId;
}): Promise<{ audio: ArrayBuffer; contentType: string }> {
  const text = options.text.trim();
  if (!text) {
    throw new Error("Texto vacío");
  }
  if (text.length > 2500) {
    throw new Error("Texto demasiado largo para narración");
  }

  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY no configurada");
  }

  const voiceId = resolveElevenLabsVoiceId(options.voiceProfile);
  const response = await fetch(`${ELEVENLABS_TTS_URL}/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: ELEVENLABS_MODEL_ID,
      voice_settings: {
        stability: 0.62,
        similarity_boost: 0.75,
        style: 0.1,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `ElevenLabs TTS falló (${response.status})${detail ? `: ${detail.slice(0, 180)}` : ""}`
    );
  }

  const audio = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") || "audio/mpeg";
  return { audio, contentType };
}

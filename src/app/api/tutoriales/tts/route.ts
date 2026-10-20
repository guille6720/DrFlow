import { NextResponse } from "next/server";

import { getSession } from "@/core/auth/session.server";
import { requireSameOriginMutation } from "@/core/security/csrf";

import {
  isElevenLabsConfigured,
  synthesizeElevenLabsSpeech,
} from "@/features/tutoriales/lib/elevenlabs-tts";
import {
  NARRATION_VOICE_PROFILES,
  type NarrationVoiceProfileId,
} from "@/features/tutoriales/lib/voice-profiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isVoiceProfile(value: unknown): value is NarrationVoiceProfileId {
  return (
    typeof value === "string" &&
    (NARRATION_VOICE_PROFILES as readonly string[]).includes(value)
  );
}

/** Lightweight probe — does not spend ElevenLabs credits. */
export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ configured: false }, { status: 401 });
  }
  return NextResponse.json({
    configured: isElevenLabsConfigured(),
    voices: [...NARRATION_VOICE_PROFILES],
  });
}

/**
 * Tutoriales TTS — Brian C / Horacio via ElevenLabs.
 * Only tutorial narration scripts (no patient payloads).
 */
export async function POST(request: Request) {
  const csrfBlock = requireSameOriginMutation(request);
  if (csrfBlock) return csrfBlock;

  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!isElevenLabsConfigured()) {
    return NextResponse.json(
      { error: "Narración ElevenLabs no configurada" },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const text =
    typeof body === "object" && body && "text" in body && typeof body.text === "string"
      ? body.text
      : "";
  const voiceProfile =
    typeof body === "object" &&
    body &&
    "voiceProfile" in body &&
    isVoiceProfile(body.voiceProfile)
      ? body.voiceProfile
      : null;

  if (!text.trim() || !voiceProfile) {
    return NextResponse.json(
      { error: "text y voiceProfile (brian|horacio) son requeridos" },
      { status: 400 }
    );
  }

  try {
    const { audio, contentType } = await synthesizeElevenLabsSpeech({
      text,
      voiceProfile,
    });
    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("[tutoriales/tts]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error de narración" },
      { status: 502 }
    );
  }
}

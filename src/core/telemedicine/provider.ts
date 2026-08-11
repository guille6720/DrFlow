import "server-only";

import { getPublicSiteUrl } from "@/core/supabase/env";

export type TelemedicineProviderId = "jitsi" | "daily";

export type TelemedicineRoomPayload = {
  provider: TelemedicineProviderId;
  roomUrl: string;
  externalRoomId: string | null;
  expiresAt: string | null;
};

const JITSI_HOST = "https://meet.jit.si";
const DAILY_API = "https://api.daily.co/v1";

export function isDailyTelemedicineConfigured(): boolean {
  return Boolean(process.env.DAILY_API_KEY?.trim());
}

export function buildJitsiRoomName(appointmentId: string): string {
  const slug = appointmentId.replace(/-/g, "").slice(0, 12);
  return `drflow-${slug}-${Date.now().toString(36)}`;
}

export function buildJitsiRoomUrl(roomName: string): string {
  return `${JITSI_HOST}/${roomName}`;
}

export function extractJitsiRoomName(roomUrl: string): string | null {
  try {
    const url = new URL(roomUrl);
    if (!url.hostname.includes("jit.si")) return null;
    const name = url.pathname.replace(/^\//, "").trim();
    return name || null;
  } catch {
    return null;
  }
}

export function buildTelemedicineEmbedUrl(roomUrl: string, displayName?: string): string {
  const roomName = extractJitsiRoomName(roomUrl);
  if (!roomName) {
    return roomUrl;
  }
  const params = new URLSearchParams();
  if (displayName?.trim()) {
    params.set("userInfo.displayName", displayName.trim());
  }
  params.set("config.prejoinPageEnabled", "true");
  params.set("config.startWithAudioMuted", "false");
  params.set("config.startWithVideoMuted", "false");
  const hash = params.toString();
  return `${JITSI_HOST}/${roomName}${hash ? `#${hash}` : ""}`;
}

export function buildPatientJoinPath(sessionId: string): string {
  return `/videoconsulta/${sessionId}`;
}

export function buildPatientJoinUrl(sessionId: string): string {
  return `${getPublicSiteUrl()}${buildPatientJoinPath(sessionId)}`;
}

export function defaultTelemedicineExpiry(appointmentStartAt: string): string {
  const start = new Date(appointmentStartAt);
  const end = new Date(start);
  end.setHours(end.getHours() + 4);
  return end.toISOString();
}

async function createDailyRoom(input: {
  appointmentId: string;
  appointmentStartAt: string;
}): Promise<TelemedicineRoomPayload | null> {
  const apiKey = process.env.DAILY_API_KEY?.trim();
  if (!apiKey) return null;

  const domain = process.env.DAILY_DOMAIN?.trim();
  const roomName = buildJitsiRoomName(input.appointmentId).toLowerCase();
  const exp = Math.floor(new Date(defaultTelemedicineExpiry(input.appointmentStartAt)).getTime() / 1000);

  const response = await fetch(`${DAILY_API}/rooms`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: roomName,
      properties: {
        exp,
        enable_chat: true,
        start_video_off: false,
        start_audio_off: false,
        ...(domain ? { domain } : {}),
      },
    }),
  });

  if (!response.ok) return null;

  const data = (await response.json()) as { url?: string; name?: string; id?: string };
  if (!data.url) return null;

  return {
    provider: "daily",
    roomUrl: data.url,
    externalRoomId: data.name ?? data.id ?? roomName,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

function createJitsiRoom(input: {
  appointmentId: string;
  appointmentStartAt: string;
}): TelemedicineRoomPayload {
  const roomName = buildJitsiRoomName(input.appointmentId);
  return {
    provider: "jitsi",
    roomUrl: buildJitsiRoomUrl(roomName),
    externalRoomId: roomName,
    expiresAt: defaultTelemedicineExpiry(input.appointmentStartAt),
  };
}

export async function createTelemedicineRoom(input: {
  appointmentId: string;
  appointmentStartAt: string;
}): Promise<TelemedicineRoomPayload> {
  if (isDailyTelemedicineConfigured()) {
    const daily = await createDailyRoom(input);
    if (daily) return daily;
  }
  return createJitsiRoom(input);
}

export function isTelemedicineSessionJoinable(input: {
  status: string;
  expiresAt: string | null;
  appointmentStartAt: string;
}): boolean {
  if (input.status === "cancelled" || input.status === "completed") return false;
  if (input.expiresAt && new Date(input.expiresAt).getTime() < Date.now()) return false;

  const startMs = new Date(input.appointmentStartAt).getTime();
  const earliest = startMs - 24 * 60 * 60 * 1000;
  const latest = startMs + 3 * 60 * 60 * 1000;
  const now = Date.now();
  return now >= earliest && now <= latest;
}

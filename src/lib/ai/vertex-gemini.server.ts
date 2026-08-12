import "server-only";

import { createSign } from "crypto";

import type { AiChatMessage } from "@/lib/ai/user-ai-provider-types";
import { getVertexGeminiConfig, type VertexGeminiConfig } from "@/lib/ai/vertex-gemini-config";

type ServiceAccount = {
  client_email: string;
  private_key: string;
};

type CachedToken = {
  accessToken: string;
  expiresAt: number;
};

let tokenCache: CachedToken | null = null;

function base64Url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function parseServiceAccount(raw: string): ServiceAccount | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!parsed.client_email || !parsed.private_key) return null;
    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    return null;
  }
}

function signServiceAccountJwt(account: ServiceAccount): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iss: account.client_email,
      sub: account.client_email,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
      scope: "https://www.googleapis.com/auth/cloud-platform",
    })
  );
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  return `${unsigned}.${base64Url(signer.sign(account.private_key))}`;
}

async function getAccessToken(config: VertexGeminiConfig): Promise<string | null> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }

  const account = parseServiceAccount(config.serviceAccountJson);
  if (!account) return null;

  const assertion = signServiceAccountJwt(account);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) return null;

  const json = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;

  tokenCache = {
    accessToken: json.access_token,
    expiresAt: Date.now() + Math.max(60, json.expires_in ?? 3600) * 1000,
  };
  return json.access_token;
}

function extractGeminiText(json: unknown): string | null {
  const payload = json as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  return text || null;
}

function toGeminiContents(messages: AiChatMessage[]) {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
}

const GENERATION_CONFIG = {
  temperature: 0.2,
  maxOutputTokens: 2048,
  responseMimeType: "application/json",
};

export async function callVertexGemini(input: {
  systemPrompt: string;
  messages: AiChatMessage[];
}): Promise<string | null> {
  const config = getVertexGeminiConfig();
  if (!config) return null;

  const accessToken = await getAccessToken(config);
  if (!accessToken) return null;

  const url = `https://${config.location}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(config.project)}/locations/${encodeURIComponent(config.location)}/publishers/google/models/${encodeURIComponent(config.model)}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.systemPrompt }] },
      contents: toGeminiContents(input.messages),
      generationConfig: GENERATION_CONFIG,
    }),
  });

  if (!response.ok) return null;
  return extractGeminiText(await response.json());
}

export async function callGeminiApi(input: {
  apiKey: string;
  systemPrompt: string;
  messages: AiChatMessage[];
  model?: string;
}): Promise<string | null> {
  const model = (input.model ?? "gemini-1.5-flash").trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.systemPrompt }] },
      contents: toGeminiContents(input.messages),
      generationConfig: GENERATION_CONFIG,
    }),
  });

  if (!response.ok) return null;
  return extractGeminiText(await response.json());
}

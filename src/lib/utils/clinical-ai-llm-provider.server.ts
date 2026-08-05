import "server-only";

import type { AiChatMessage, UserAiCredentials } from "@/lib/ai/user-ai-provider-types";
import type { ClinicalAiAgentId, ClinicalAiEngine } from "@/lib/utils/clinical-ai-orchestrator";

type LlmEnhanceInput = {
  agentId: ClinicalAiAgentId;
  body: string;
  contextSummary?: string;
  credentials?: UserAiCredentials | null;
};

type LlmEnhanceResult = {
  body: string;
  engine: ClinicalAiEngine;
};

type UserAiChatInput = {
  credentials: UserAiCredentials;
  messages: AiChatMessage[];
  contextSummary?: string;
  ruleBasedFallback?: string;
};

const SYSTEM_PROMPT = `Sos un asistente clínico administrativo en DrFlow (Argentina).
Respondé en español claro y profesional.
NO inventes diagnósticos, medicación ni órdenes.
NO tomes decisiones clínicas: ayudá al profesional con redacción, resúmenes y orientación operativa.
Si falta contexto, pedí aclaración breve.
Cuando recibas un borrador rule-based, podés mejorarlo sin cambiar los hechos.`;

/** Whether a platform-level LLM API key is configured (env). */
export function isClinicalLlmConfigured(): boolean {
  return Boolean(
    process.env.CLINICAL_AI_LLM_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
  );
}

function resolveEnvCredentials(): UserAiCredentials | null {
  const apiKey = process.env.CLINICAL_AI_LLM_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) return null;
  return {
    provider: "openai",
    apiKey: apiKey.trim(),
    baseUrl: (process.env.CLINICAL_AI_LLM_BASE_URL ?? "https://api.openai.com/v1").replace(
      /\/$/,
      ""
    ),
    model: process.env.CLINICAL_AI_LLM_MODEL ?? "gpt-4o-mini",
  };
}

async function callOpenAiCompatibleChat(
  credentials: UserAiCredentials,
  messages: AiChatMessage[],
  contextSummary?: string
): Promise<string | null> {
  const baseUrl = (
    credentials.baseUrl ??
    (credentials.provider === "openai" ? "https://api.openai.com/v1" : null)
  )?.replace(/\/$/, "");

  if (!baseUrl) return null;

  const systemParts = [SYSTEM_PROMPT];
  if (contextSummary) systemParts.push(`Contexto clínico: ${contextSummary}`);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credentials.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: credentials.model,
      temperature: 0.3,
      max_tokens: 1200,
      messages: [
        { role: "system", content: systemParts.join("\n\n") },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });

  if (!response.ok) return null;

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  return text || null;
}

async function callAnthropicChat(
  credentials: UserAiCredentials,
  messages: AiChatMessage[],
  contextSummary?: string
): Promise<string | null> {
  const baseUrl = (credentials.baseUrl ?? "https://api.anthropic.com/v1").replace(/\/$/, "");

  const systemParts = [SYSTEM_PROMPT];
  if (contextSummary) systemParts.push(`Contexto clínico: ${contextSummary}`);

  const response = await fetch(`${baseUrl}/messages`, {
    method: "POST",
    headers: {
      "x-api-key": credentials.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: credentials.model,
      max_tokens: 1200,
      system: systemParts.join("\n\n"),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!response.ok) return null;

  const json = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = json.content?.find((c) => c.type === "text")?.text?.trim();
  return text || null;
}

async function callGeminiChat(
  credentials: UserAiCredentials,
  messages: AiChatMessage[],
  contextSummary?: string
): Promise<string | null> {
  const baseUrl = (
    credentials.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta"
  ).replace(/\/$/, "");
  const model = credentials.model.trim();
  if (!model) return null;

  const systemParts = [SYSTEM_PROMPT];
  if (contextSummary) systemParts.push(`Contexto clínico: ${contextSummary}`);

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(credentials.apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemParts.join("\n\n") }],
      },
      contents,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1200,
      },
    }),
  });

  if (!response.ok) return null;

  const json = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  return text || null;
}

async function callUserAiChatInternal(
  credentials: UserAiCredentials,
  messages: AiChatMessage[],
  contextSummary?: string
): Promise<string | null> {
  if (credentials.provider === "anthropic") {
    return callAnthropicChat(credentials, messages, contextSummary);
  }
  if (credentials.provider === "gemini") {
    return callGeminiChat(credentials, messages, contextSummary);
  }
  return callOpenAiCompatibleChat(credentials, messages, contextSummary);
}

/** Multi-turn chat using the user's preferred provider (or env fallback). */
export async function runUserAiChat(input: UserAiChatInput): Promise<LlmEnhanceResult> {
  const fallback = input.ruleBasedFallback ?? "No pude obtener respuesta del modelo en este momento.";

  try {
    const text = await callUserAiChatInternal(
      input.credentials,
      input.messages,
      input.contextSummary
    );
    if (!text) {
      return { body: fallback, engine: "rule_based" };
    }
    return { body: text, engine: "llm_enhanced" };
  } catch {
    return { body: fallback, engine: "rule_based" };
  }
}

/** Optionally rephrase orchestrator output via LLM — falls back to rule-based on any error. */
export async function enhanceClinicalAiBodyIfConfigured(
  input: LlmEnhanceInput
): Promise<LlmEnhanceResult> {
  const credentials = input.credentials ?? resolveEnvCredentials();
  if (!credentials) {
    return { body: input.body, engine: "rule_based" };
  }

  const userContent = [
    `Agente: ${input.agentId}`,
    input.contextSummary ? `Contexto: ${input.contextSummary}` : null,
    "",
    "Borrador:",
    input.body,
  ]
    .filter(Boolean)
    .join("\n");

  return runUserAiChat({
    credentials,
    messages: [{ role: "user", content: userContent }],
    contextSummary: input.contextSummary,
    ruleBasedFallback: input.body,
  });
}

export function resolveAiCredentialsForRequest(
  userCredentials: UserAiCredentials | null
): UserAiCredentials | null {
  return userCredentials ?? resolveEnvCredentials();
}

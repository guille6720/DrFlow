import "server-only";

import type { ClinicalAiAgentId, ClinicalAiEngine } from "@/lib/utils/clinical-ai-orchestrator";

type LlmEnhanceInput = {
  agentId: ClinicalAiAgentId;
  body: string;
  contextSummary?: string;
};

type LlmEnhanceResult = {
  body: string;
  engine: ClinicalAiEngine;
};

const SYSTEM_PROMPT = `Sos un asistente clínico administrativo en DrFlow (Argentina).
Reformulá el texto provisto en español claro y profesional.
NO agregues diagnósticos, medicación ni órdenes nuevas.
NO tomes decisiones clínicas. Solo mejorá la redacción del borrador rule-based.
Mantené el mismo contenido factual.`;

/** Whether an external LLM API key is configured (optional Phase F enhancement). */
export function isClinicalLlmConfigured(): boolean {
  return Boolean(
    process.env.CLINICAL_AI_LLM_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
  );
}

async function callChatCompletions(userContent: string): Promise<string | null> {
  const apiKey = process.env.CLINICAL_AI_LLM_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) return null;

  const baseUrl = (process.env.CLINICAL_AI_LLM_BASE_URL ?? "https://api.openai.com/v1").replace(
    /\/$/,
    ""
  );
  const model = process.env.CLINICAL_AI_LLM_MODEL ?? "gpt-4o-mini";

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 800,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
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

/** Optionally rephrase orchestrator output via LLM — falls back to rule-based on any error. */
export async function enhanceClinicalAiBodyIfConfigured(
  input: LlmEnhanceInput
): Promise<LlmEnhanceResult> {
  if (!isClinicalLlmConfigured()) {
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

  try {
    const enhanced = await callChatCompletions(userContent);
    if (!enhanced) return { body: input.body, engine: "rule_based" };
    return { body: enhanced, engine: "llm_enhanced" };
  } catch {
    return { body: input.body, engine: "rule_based" };
  }
}

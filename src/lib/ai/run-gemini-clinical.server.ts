import "server-only";

import { formatGeminiClinicalContext } from "@/lib/ai/gemini-clinical-context";
import { GEMINI_CLINICAL_SYSTEM_PROMPT } from "@/lib/ai/gemini-clinical-system-prompt";
import {
  formatGeminiStructuredBody,
  type GeminiStructuredResponse,
  parseGeminiStructuredResponse,
} from "@/lib/ai/gemini-structured-response";
import { loadGeminiClinicalContext } from "@/lib/ai/load-gemini-clinical-context.server";
import type { AiChatMessage } from "@/lib/ai/user-ai-provider-types";
import { callGeminiApi, callVertexGemini } from "@/lib/ai/vertex-gemini.server";
import { getGeminiApiKey, isVertexGeminiConfigured } from "@/lib/ai/vertex-gemini-config";
import type { ClinicalAiEngine } from "@/lib/utils/clinical-ai-orchestrator";

export type GeminiClinicalChatResult = {
  body: string;
  structured: GeminiStructuredResponse;
  engine: ClinicalAiEngine;
};

function buildUserPrompt(message: string, clinicalContext: string | null): string {
  if (!clinicalContext) return message;
  return `Contexto clínico anonimizado (no incluye identidad):\n${clinicalContext}\n\nConsulta del médico:\n${message}`;
}

export async function runGeminiClinicalChat(input: {
  clinicId: string;
  patientId?: string;
  message: string;
  chatHistory?: AiChatMessage[];
  geminiApiKey?: string | null;
  geminiModel?: string;
}): Promise<GeminiClinicalChatResult | null> {
  const vertexReady = isVertexGeminiConfigured();
  const apiKey = input.geminiApiKey?.trim() || getGeminiApiKey();
  if (!vertexReady && !apiKey) return null;

  let clinicalContext: string | null = null;
  if (input.patientId) {
    const loaded = await loadGeminiClinicalContext(input.clinicId, input.patientId);
    if (loaded) clinicalContext = formatGeminiClinicalContext(loaded);
  }

  const messages: AiChatMessage[] = [
    ...(input.chatHistory ?? []).slice(-16),
    { role: "user", content: buildUserPrompt(input.message, clinicalContext) },
  ];

  let raw: string | null = null;
  let engine: ClinicalAiEngine = "rule_based";

  if (vertexReady) {
    raw = await callVertexGemini({
      systemPrompt: GEMINI_CLINICAL_SYSTEM_PROMPT,
      messages,
    });
    if (raw) engine = "vertex_gemini";
  }

  if (!raw && apiKey) {
    raw = await callGeminiApi({
      apiKey,
      systemPrompt: GEMINI_CLINICAL_SYSTEM_PROMPT,
      messages,
      model: input.geminiModel,
    });
    if (raw) engine = "gemini_api";
  }

  if (!raw) return null;

  const structured = parseGeminiStructuredResponse(raw);
  return {
    structured,
    body: formatGeminiStructuredBody(structured),
    engine,
  };
}

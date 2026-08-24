import "server-only";

import {
  ClinicalAiSanitizationError,
} from "@/lib/ai/clinical-ai-failsafe";
import {
  sanitizeClinicalAIChatMessages,
  sanitizeClinicalAIInput,
  type SanitizeClinicalAIOptions,
} from "@/lib/ai/sanitize-clinical-ai-input";
import type { AiChatMessage } from "@/lib/ai/user-ai-provider-types";
import { callGeminiApi, callVertexGemini } from "@/lib/ai/vertex-gemini.server";

export { ClinicalAiSanitizationError };

export type PreparedExternalClinicalAiPayload = {
  messages: AiChatMessage[];
  redactionCount: number;
  status: "ok" | "partial";
};

/**
 * Mandatory server-side gate before any external clinical AI HTTP request.
 * Sanitizes all message content; throws if residual PII cannot be removed.
 */
export function prepareExternalClinicalAiPayload(input: {
  messages: AiChatMessage[];
  knownIdentifiers?: string[];
  failOnResidualPii?: boolean;
}): PreparedExternalClinicalAiPayload {
  const options: SanitizeClinicalAIOptions = {
    knownIdentifiers: input.knownIdentifiers,
    failOnResidualPii: input.failOnResidualPii ?? true,
  };

  const history = sanitizeClinicalAIChatMessages(
    input.messages.map((m) => ({ role: m.role, content: m.content })),
    options
  );

  if (history.blocked) {
    throw new ClinicalAiSanitizationError(
      history.blockReason ?? "No se pudo anonimizar el contenido para el proveedor de IA.",
    );
  }

  let redactionCount = 0;
  let hadPartial = false;

  for (const original of input.messages) {
    const result = sanitizeClinicalAIInput(original.content, options);
    if (result.redactionCount > 0) redactionCount += result.redactionCount;
    if (result.status === "partial") hadPartial = true;
  }

  return {
    messages: history.messages.map((m) => ({
      role: m.role as AiChatMessage["role"],
      content: m.content,
    })),
    redactionCount,
    status: hadPartial || redactionCount > 0 ? "partial" : "ok",
  };
}

/** Sanitize free-text clinical context blocks before inclusion in prompts. */
export function sanitizeClinicalContextBlock(
  text: string,
  knownIdentifiers: string[] = []
): string {
  const result = sanitizeClinicalAIInput(text, { knownIdentifiers });
  if (result.blocked) {
    throw new ClinicalAiSanitizationError(
      result.blockReason ?? "Contexto clínico no pudo anonimizarse.",
      result
    );
  }
  return result.sanitized;
}

export async function callVertexGeminiSanitized(input: {
  systemPrompt: string;
  messages: AiChatMessage[];
  knownIdentifiers?: string[];
}): Promise<{ text: string | null; sanitization: PreparedExternalClinicalAiPayload }> {
  const prepared = prepareExternalClinicalAiPayload({
    messages: input.messages,
    knownIdentifiers: input.knownIdentifiers,
  });
  const text = await callVertexGemini({
    systemPrompt: input.systemPrompt,
    messages: prepared.messages,
  });
  return { text, sanitization: prepared };
}

export async function callGeminiApiSanitized(input: {
  apiKey: string;
  systemPrompt: string;
  messages: AiChatMessage[];
  model?: string;
  knownIdentifiers?: string[];
}): Promise<{ text: string | null; sanitization: PreparedExternalClinicalAiPayload }> {
  const prepared = prepareExternalClinicalAiPayload({
    messages: input.messages,
    knownIdentifiers: input.knownIdentifiers,
  });
  const text = await callGeminiApi({
    apiKey: input.apiKey,
    systemPrompt: input.systemPrompt,
    messages: prepared.messages,
    model: input.model,
  });
  return { text, sanitization: prepared };
}

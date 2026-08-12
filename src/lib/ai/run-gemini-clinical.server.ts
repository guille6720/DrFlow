import "server-only";

import {
  formatGeminiClinicStatsContext,
  parseGeminiClinicStatsQuery,
} from "@/lib/ai/gemini-clinic-stats";
import { formatGeminiClinicalContext } from "@/lib/ai/gemini-clinical-context";
import { GEMINI_CLINICAL_SYSTEM_PROMPT } from "@/lib/ai/gemini-clinical-system-prompt";
import { geminiStatsToStructured } from "@/lib/ai/gemini-stats-response";
import {
  formatGeminiStructuredBody,
  type GeminiStructuredResponse,
  parseGeminiStructuredResponse,
} from "@/lib/ai/gemini-structured-response";
import { loadGeminiClinicStats } from "@/lib/ai/load-gemini-clinic-stats.server";
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

function buildUserPrompt(
  message: string,
  clinicalContext: string | null,
  statsContext: string | null
): string {
  const parts = [];
  if (statsContext) {
    parts.push(
      "Datos del consultorio (fuente: base DrFlow, no inventar ni agregar pacientes):\n" +
        statsContext
    );
  }
  if (clinicalContext) {
    parts.push(`Contexto clínico anonimizado (no incluye identidad):\n${clinicalContext}`);
  }
  parts.push(`Consulta del médico:\n${message}`);
  return parts.join("\n\n");
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

  const statsQuery = parseGeminiClinicStatsQuery(input.message);
  const statsResult = statsQuery
    ? await loadGeminiClinicStats(input.clinicId, statsQuery)
    : null;
  const statsStructured = statsResult ? geminiStatsToStructured(statsResult) : null;

  let clinicalContext: string | null = null;
  if (!statsQuery && input.patientId) {
    const loaded = await loadGeminiClinicalContext(input.clinicId, input.patientId);
    if (loaded) clinicalContext = formatGeminiClinicalContext(loaded);
  }

  if (!vertexReady && !apiKey) {
    if (!statsStructured) return null;
    return {
      structured: statsStructured,
      body: formatGeminiStructuredBody(statsStructured),
      engine: "rule_based",
    };
  }

  const messages: AiChatMessage[] = [
    ...(input.chatHistory ?? []).slice(-16),
    {
      role: "user",
      content: buildUserPrompt(
        input.message,
        clinicalContext,
        statsResult ? formatGeminiClinicStatsContext(statsResult) : null
      ),
    },
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

  if (!raw) {
    if (!statsStructured) return null;
    return {
      structured: statsStructured,
      body: formatGeminiStructuredBody(statsStructured),
      engine: "rule_based",
    };
  }

  const parsed = parseGeminiStructuredResponse(raw);
  const structured: GeminiStructuredResponse = statsStructured
    ? {
        ...parsed,
        summary: parsed.summary || statsStructured.summary,
        findings: statsStructured.findings,
        warnings: [...statsStructured.warnings, ...parsed.warnings],
        patients: statsStructured.patients,
      }
    : parsed;

  return {
    structured,
    body: formatGeminiStructuredBody(structured),
    engine,
  };
}

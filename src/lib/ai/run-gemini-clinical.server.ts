import "server-only";

import { recordAiAuditEvent } from "@/core/compliance/ai-audit";
import {
  CLINICAL_RESEARCH_DISABLED_USER_MESSAGE,
  CLINICAL_RESEARCH_PROTOCOLS_FLAG,
  detectsClinicalResearchIntent,
} from "@/core/compliance/clinical-research-ai";
import { createClient } from "@/core/supabase/server";

import { isFeatureFlagEnabled } from "@/features/flags/lib/resolve";

import {
  callGeminiApiSanitized,
  callVertexGeminiSanitized,
  ClinicalAiSanitizationError,
  sanitizeClinicalContextBlock,
} from "@/lib/ai/external-clinical-ai-gateway.server";
import {
  formatGeminiClinicStatsContextForAI,
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
import { loadPatientKnownIdentifiers } from "@/lib/ai/patient-ai-identifiers.server";
import { sanitizeClinicalAIInput } from "@/lib/ai/sanitize-clinical-ai-input";
import type { AiChatMessage } from "@/lib/ai/user-ai-provider-types";
import { getGeminiApiKey, isVertexGeminiConfigured } from "@/lib/ai/vertex-gemini-config";
import { loadClinicFeatures } from "@/lib/server/load-clinic-feature-flags";
import type { ClinicalAiEngine } from "@/lib/utils/clinical-ai-orchestrator";

export type GeminiClinicalChatResult = {
  body: string;
  structured: GeminiStructuredResponse;
  engine: ClinicalAiEngine;
};

export { ClinicalAiSanitizationError };

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

  const knownIdentifiers = input.patientId
    ? await loadPatientKnownIdentifiers(input.clinicId, input.patientId)
    : [];

  const supabase = await createClient();
  const clinicFeatures = await loadClinicFeatures(supabase, input.clinicId);
  const researchEnabled = isFeatureFlagEnabled(clinicFeatures, CLINICAL_RESEARCH_PROTOCOLS_FLAG);

  if (!researchEnabled && detectsClinicalResearchIntent(input.message)) {
    const structured: GeminiStructuredResponse = {
      summary: CLINICAL_RESEARCH_DISABLED_USER_MESSAGE,
      findings: [],
      suggestions: [
        "Completar revisión legal/privacidad documentada (Fase 18) antes de activar el flag.",
      ],
      warnings: [
        "Flag clinic: clinical_research_protocols (default OFF).",
        "No se ejecuta matching de candidatos ni catálogo de protocolos.",
      ],
      disclaimer:
        "Funcionalidad de investigación clínica desactivada hasta revisión. No constituye elegibilidad de ensayo.",
    };
    return {
      structured,
      body: formatGeminiStructuredBody(structured),
      engine: "rule_based",
    };
  }

  const statsQuery = parseGeminiClinicStatsQuery(input.message, {
    allowClinicalResearchProtocols: researchEnabled,
  });
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

  const messageSanitized = sanitizeClinicalAIInput(input.message, { knownIdentifiers });
  if (messageSanitized.blocked) {
    throw new ClinicalAiSanitizationError(
      messageSanitized.blockReason ?? "Sanitización bloqueada.",
      messageSanitized
    );
  }

  const statsContextForAi = statsResult
    ? sanitizeClinicalContextBlock(formatGeminiClinicStatsContextForAI(statsResult), knownIdentifiers)
    : null;

  const safeClinicalContext = clinicalContext
    ? sanitizeClinicalContextBlock(clinicalContext, knownIdentifiers)
    : null;

  const priorMessages: AiChatMessage[] = (input.chatHistory ?? []).slice(-16).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const userPrompt = buildUserPrompt(
    messageSanitized.sanitized,
    safeClinicalContext,
    statsContextForAi
  );

  const messages: AiChatMessage[] = [...priorMessages, { role: "user", content: userPrompt }];

  let raw: string | null = null;
  let engine: ClinicalAiEngine = "rule_based";
  let provider: "vertex_gemini" | "gemini_api" = "vertex_gemini";
  let redactionCount = messageSanitized.redactionCount;
  let sanitizationStatus: "ok" | "partial" =
    messageSanitized.status === "partial" ? "partial" : "ok";

  if (vertexReady) {
    const vertex = await callVertexGeminiSanitized({
      systemPrompt: GEMINI_CLINICAL_SYSTEM_PROMPT,
      messages,
      knownIdentifiers,
    });
    raw = vertex.text;
    redactionCount += vertex.sanitization.redactionCount;
    if (vertex.sanitization.status === "partial") sanitizationStatus = "partial";
    if (raw) engine = "vertex_gemini";
  }

  if (!raw && apiKey) {
    provider = "gemini_api";
    const gemini = await callGeminiApiSanitized({
      apiKey,
      systemPrompt: GEMINI_CLINICAL_SYSTEM_PROMPT,
      messages,
      model: input.geminiModel,
      knownIdentifiers,
    });
    raw = gemini.text;
    redactionCount += gemini.sanitization.redactionCount;
    if (gemini.sanitization.status === "partial") sanitizationStatus = "partial";
    if (raw) engine = "gemini_api";
  }

  await recordAiAuditEvent({
    clinicId: input.clinicId,
    patientId: input.patientId,
    feature: "gemini_clinical_chat",
    provider,
    model: input.geminiModel,
    success: Boolean(raw),
    sanitizationStatus,
    redactionCount,
    errorCode: raw ? undefined : "no_model_response",
  });

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

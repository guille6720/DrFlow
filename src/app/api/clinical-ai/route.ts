import { NextResponse } from "next/server";

import { getActiveClinic, getActiveClinicId } from "@/core/auth/session.server";
import { withObservabilityApiRoute } from "@/core/observability/api-route";
import { hasPermission } from "@/core/permissions/roles";
import { requireSameOriginMutation } from "@/core/security/csrf";
import { clinicalAiRequestSchema } from "@/core/validations/clinical-ai-api";

import { runGeminiClinicalChat } from "@/lib/ai/run-gemini-clinical.server";
import {
  getUserAiConnectionPublic,
  getUserAiCredentialsForSession,
} from "@/lib/ai/user-ai-credentials.server";
import type { AiChatMessage } from "@/lib/ai/user-ai-provider-types";
import { isClinicGeminiConfigured, isVertexGeminiConfigured } from "@/lib/ai/vertex-gemini-config";
import {
  enhanceClinicalAiBodyIfConfigured,
  isClinicalLlmConfigured,
  resolveAiCredentialsForRequest,
  runUserAiChat,
} from "@/lib/utils/clinical-ai-llm-provider.server";
import {
  listClinicalAiAgents,
  runClinicalAiOrchestrator,
} from "@/lib/utils/clinical-ai-orchestrator";
import { buildClinicalAiOrchestratorInput } from "@/lib/utils/clinical-ai-request-mapper";
import { buildClinicalCopilotContextSummary } from "@/lib/utils/clinical-copilot-responses";

function buildCopilotChatMessages(
  history: AiChatMessage[] | undefined,
  message: string | undefined
): AiChatMessage[] {
  const prior = history ?? [];
  if (!message?.trim()) return prior;
  return [...prior, { role: "user", content: message.trim() }];
}

/** POST /api/clinical-ai — unified orchestrator endpoint (Phase F). */
export const POST = withObservabilityApiRoute("clinical_ai", async (request, ctx) => {
  const csrfBlock = requireSameOriginMutation(request);
  if (csrfBlock) return csrfBlock;

  const clinicId = await getActiveClinicId();
  ctx.clinicId = clinicId;
  const { role, isSuperadmin } = await getActiveClinic();

  if (!clinicId) {
    return NextResponse.json({ error: "Sin consultorio activo" }, { status: 401 });
  }

  const canUse =
    hasPermission(role, "viewClinicalRecords", isSuperadmin) ||
    hasPermission(role, "editClinicalRecords", isSuperadmin);
  if (!canUse) {
    return NextResponse.json({ error: "Sin permisos clínicos" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = clinicalAiRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const payload = parsed.data;
  const orchestratorInput = buildClinicalAiOrchestratorInput(payload);
  const result = runClinicalAiOrchestrator(orchestratorInput);

  const userCredentials = payload.useUserProvider
    ? await getUserAiCredentialsForSession()
    : null;
  const credentials = resolveAiCredentialsForRequest(userCredentials);
  const geminiReady =
    isClinicGeminiConfigured() || credentials?.provider === "gemini";
  const wantsLlm =
    (Boolean(credentials) || geminiReady) &&
    (payload.enhanceWithLlm || payload.useUserProvider || payload.task === "copilot_query");

  if (payload.task === "copilot_query" && payload.message?.trim() && geminiReady) {
    const geminiResult = await runGeminiClinicalChat({
      clinicId,
      patientId: payload.patientId,
      message: payload.message.trim(),
      chatHistory: payload.chatHistory,
      geminiApiKey: credentials?.provider === "gemini" ? credentials.apiKey : null,
      geminiModel: credentials?.provider === "gemini" ? credentials.model : undefined,
    });
    if (geminiResult) {
      result.body = geminiResult.body;
      result.engine = geminiResult.engine;
      result.structured = geminiResult.structured;
      return NextResponse.json({ result });
    }
  }

  if (wantsLlm && credentials) {
    const copilotCtx = orchestratorInput.copilotContext ?? {};
    const contextSummary =
      buildClinicalCopilotContextSummary(copilotCtx) || payload.patientName || undefined;

    if (payload.task === "copilot_query" && payload.message?.trim()) {
      const chatResult = await runUserAiChat({
        credentials,
        messages: buildCopilotChatMessages(payload.chatHistory, payload.message),
        contextSummary,
        ruleBasedFallback: result.body,
      });
      result.body = chatResult.body;
      result.engine = chatResult.engine;
    } else {
      const enhanced = await enhanceClinicalAiBodyIfConfigured({
        agentId: result.agentId,
        body: result.body,
        contextSummary,
        credentials,
      });
      result.body = enhanced.body;
      result.engine = enhanced.engine;
    }
  }

  return NextResponse.json({ result });
});

export const GET = withObservabilityApiRoute("clinical_ai_meta", async (_request, ctx) => {
  const clinicId = await getActiveClinicId();
  ctx.clinicId = clinicId;
  const { role, isSuperadmin } = await getActiveClinic();
  const canUse =
    hasPermission(role, "viewClinicalRecords", isSuperadmin) ||
    hasPermission(role, "editClinicalRecords", isSuperadmin);
  if (!canUse) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const userConnection = await getUserAiConnectionPublic();

  return NextResponse.json({
    agents: listClinicalAiAgents(),
    llmConfigured: isClinicalLlmConfigured() || isClinicGeminiConfigured(),
    vertexConfigured: isVertexGeminiConfigured(),
    geminiConfigured: isClinicGeminiConfigured(),
    userConnection,
    disclaimer:
      "Sugerencia asistida — requiere confirmación del médico. No reemplaza criterio clínico.",
  });
});

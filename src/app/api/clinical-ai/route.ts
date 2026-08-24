import { NextResponse } from "next/server";

import { getActiveClinic, getActiveClinicId } from "@/core/auth/session.server";
import { recordAiAuditEvent } from "@/core/compliance/ai-audit";
import { assertAutomationJobCapacity } from "@/core/entitlements/automation-jobs.server";
import { addonFeaturesForClinicalAiTask } from "@/core/entitlements/clinical-ai-features";
import { requireAddonFeatureAccess } from "@/core/entitlements/entitlements.server";
import { FEATURES } from "@/core/entitlements/features";
import { consumeAddonUsage } from "@/core/entitlements/metered.server";
import { AI_MONTHLY_QUOTA_MESSAGE } from "@/core/entitlements/metered-gate";
import { withObservabilityApiRoute } from "@/core/observability/api-route";
import { hasPermission } from "@/core/permissions/roles";
import { requireSameOriginMutation } from "@/core/security/csrf";
import { verifyPatientInClinic } from "@/core/security/ownership-guard";
import { createClient } from "@/core/supabase/server";
import { clinicalAiRequestSchema } from "@/core/validations/clinical-ai-api";

import { clinicalAiSanitizationFailureResponse } from "@/lib/ai/clinical-ai-failsafe";
import { loadPatientKnownIdentifiers } from "@/lib/ai/patient-ai-identifiers.server";
import { ClinicalAiSanitizationError, runGeminiClinicalChat } from "@/lib/ai/run-gemini-clinical.server";
import { sanitizeClinicalAIInput } from "@/lib/ai/sanitize-clinical-ai-input";
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

  const entitlement = await requireAddonFeatureAccess(FEATURES.AI);
  if (!entitlement.ok) {
    return NextResponse.json({ error: entitlement.error }, { status: 403 });
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

  for (const extraFeature of addonFeaturesForClinicalAiTask(parsed.data.task)) {
    const extra = await requireAddonFeatureAccess(extraFeature);
    if (!extra.ok) {
      return NextResponse.json({ error: extra.error }, { status: 403 });
    }
  }

  const supabase = await createClient();
  const automationCap = await assertAutomationJobCapacity({
    clinicId,
    jobType: "run_ai_task",
    payload: { task: parsed.data.task },
    supabase,
  });
  if (!automationCap.ok) {
    return NextResponse.json({ error: automationCap.error }, { status: 403 });
  }

  const quota = await consumeAddonUsage({ featureKey: FEATURES.AI_MONTHLY_REQUESTS });
  if (!quota.ok) {
    const isQuota =
      quota.error === "Se alcanzó el límite de uso del plan." ||
      /límite|quota/i.test(quota.error);
    return NextResponse.json(
      { error: isQuota ? AI_MONTHLY_QUOTA_MESSAGE : quota.error },
      { status: 403 }
    );
  }

  const payload = parsed.data;

  if (payload.patientId) {
    const owned = await verifyPatientInClinic(supabase, clinicId, payload.patientId);
    if (!owned.ok) {
      return NextResponse.json({ error: "Paciente no pertenece al consultorio activo" }, { status: 403 });
    }
  }

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

  if (payload.task === "copilot_query" && payload.message?.trim()) {
    try {
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
    } catch (err) {
      if (err instanceof ClinicalAiSanitizationError) {
        await recordAiAuditEvent({
          clinicId,
          patientId: payload.patientId,
          feature: "gemini_clinical_chat",
          provider: "unknown",
          task: payload.task,
          success: false,
          sanitizationStatus: "blocked",
          errorCode: "sanitization_blocked",
        });
        return NextResponse.json(clinicalAiSanitizationFailureResponse(err), { status: 422 });
      }
      throw err;
    }
  }

  if (wantsLlm && credentials) {
    const copilotCtx = orchestratorInput.copilotContext ?? {};
    const dbIdentifiers = payload.patientId
      ? await loadPatientKnownIdentifiers(clinicId, payload.patientId)
      : [];
    const knownIdentifiers = [
      ...dbIdentifiers,
      payload.patientName,
      copilotCtx.patientName,
      copilotCtx.assistContext?.patientName,
    ].filter((v): v is string => Boolean(v?.trim()));

    const uniqueIdentifiers = [...new Set(knownIdentifiers)];

    const rawContextSummary =
      buildClinicalCopilotContextSummary(copilotCtx) || payload.patientName || undefined;
    const sanitizedContext = rawContextSummary
      ? sanitizeClinicalAIInput(rawContextSummary, { knownIdentifiers: uniqueIdentifiers })
      : null;

    if (sanitizedContext?.blocked) {
      await recordAiAuditEvent({
        clinicId,
        patientId: payload.patientId,
        feature: "clinical_ai_byok",
        provider: credentials.provider,
        task: payload.task,
        success: false,
        sanitizationStatus: "blocked",
        errorCode: "sanitization_blocked",
      });
      return NextResponse.json(clinicalAiSanitizationFailureResponse(sanitizedContext.blockReason!), {
        status: 422,
      });
    }

    const contextSummary = sanitizedContext?.sanitized;

    if (payload.task === "copilot_query" && payload.message?.trim()) {
      try {
        const messageSanitized = sanitizeClinicalAIInput(payload.message.trim(), {
          knownIdentifiers: uniqueIdentifiers,
        });
        if (messageSanitized.blocked) {
          await recordAiAuditEvent({
            clinicId,
            patientId: payload.patientId,
            feature: "clinical_ai_byok",
            provider: credentials.provider,
            task: payload.task,
            success: false,
            sanitizationStatus: "blocked",
            errorCode: "sanitization_blocked",
          });
          return NextResponse.json(clinicalAiSanitizationFailureResponse(messageSanitized), {
            status: 422,
          });
        }

        const chatResult = await runUserAiChat({
          credentials,
          messages: buildCopilotChatMessages(payload.chatHistory, messageSanitized.sanitized),
          contextSummary,
          ruleBasedFallback: result.body,
          knownIdentifiers: uniqueIdentifiers,
          strictSanitization: true,
        });
        result.body = chatResult.body;
        result.engine = chatResult.engine;

        await recordAiAuditEvent({
          clinicId,
          patientId: payload.patientId,
          feature: "clinical_ai_byok",
          provider: credentials.provider,
          model: credentials.model,
          task: payload.task,
          success: chatResult.engine === "llm_enhanced",
          sanitizationStatus: messageSanitized.status === "partial" ? "partial" : "ok",
          redactionCount: messageSanitized.redactionCount,
        });
      } catch (err) {
        if (err instanceof ClinicalAiSanitizationError) {
          await recordAiAuditEvent({
            clinicId,
            patientId: payload.patientId,
            feature: "clinical_ai_byok",
            provider: credentials.provider,
            task: payload.task,
            success: false,
            sanitizationStatus: "blocked",
            errorCode: "sanitization_blocked",
          });
          return NextResponse.json(clinicalAiSanitizationFailureResponse(err), { status: 422 });
        }
        throw err;
      }
    } else {
      try {
        const enhanced = await enhanceClinicalAiBodyIfConfigured({
          agentId: result.agentId,
          body: result.body,
          contextSummary,
          credentials,
          knownIdentifiers: uniqueIdentifiers,
          strictSanitization: true,
        });
        result.body = enhanced.body;
        result.engine = enhanced.engine;

        await recordAiAuditEvent({
          clinicId,
          patientId: payload.patientId,
          feature: "clinical_ai_byok",
          provider: credentials.provider,
          model: credentials.model,
          task: payload.task,
          success: enhanced.engine === "llm_enhanced",
          sanitizationStatus: sanitizedContext?.status === "partial" ? "partial" : "ok",
          redactionCount: sanitizedContext?.redactionCount,
        });
      } catch (err) {
        if (err instanceof ClinicalAiSanitizationError) {
          await recordAiAuditEvent({
            clinicId,
            patientId: payload.patientId,
            feature: "clinical_ai_byok",
            provider: credentials.provider,
            task: payload.task,
            success: false,
            sanitizationStatus: "blocked",
            errorCode: "sanitization_blocked",
          });
          return NextResponse.json(clinicalAiSanitizationFailureResponse(err), { status: 422 });
        }
        throw err;
      }
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

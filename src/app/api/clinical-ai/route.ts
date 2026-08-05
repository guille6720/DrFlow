import { NextResponse } from "next/server";

import { getActiveClinic, getActiveClinicId } from "@/core/auth/session.server";
import { withObservabilityApiRoute } from "@/core/observability/api-route";
import { hasPermission } from "@/core/permissions/roles";
import { requireSameOriginMutation } from "@/core/security/csrf";
import { clinicalAiRequestSchema } from "@/core/validations/clinical-ai-api";

import {
  enhanceClinicalAiBodyIfConfigured,
  isClinicalLlmConfigured,
} from "@/lib/utils/clinical-ai-llm-provider.server";
import {
  listClinicalAiAgents,
  runClinicalAiOrchestrator,
} from "@/lib/utils/clinical-ai-orchestrator";

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
  const result = runClinicalAiOrchestrator({
    task: payload.task,
    message: payload.message,
    patientId: payload.patientId,
    patientName: payload.patientName,
    labSourceText: payload.labSourceText,
    lastConsultAt: payload.lastConsultAt ?? undefined,
    assistContext: payload.assistContext as never,
    copilotContext: payload.copilotContext as never,
    chart: payload.chart as never,
  });

  if (payload.enhanceWithLlm) {
    const enhanced = await enhanceClinicalAiBodyIfConfigured({
      agentId: result.agentId,
      body: result.body,
      contextSummary: payload.patientName,
    });
    result.body = enhanced.body;
    result.engine = enhanced.engine;
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

  return NextResponse.json({
    agents: listClinicalAiAgents(),
    llmConfigured: isClinicalLlmConfigured(),
    disclaimer:
      "Sugerencia asistida — requiere confirmación del médico. No reemplaza criterio clínico.",
  });
});

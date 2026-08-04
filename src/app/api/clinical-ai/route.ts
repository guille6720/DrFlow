import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveClinic, getActiveClinicId } from "@/core/auth/session";
import { hasPermission } from "@/core/permissions/roles";
import {
  runClinicalAiOrchestrator,
  listClinicalAiAgents,
  type ClinicalAiTask,
} from "@/lib/utils/clinical-ai-orchestrator";
import { enhanceClinicalAiBodyIfConfigured, isClinicalLlmConfigured } from "@/lib/utils/clinical-ai-llm-provider.server";

const TASK_VALUES = [
  "pre_visit_brief",
  "consultation_documentation",
  "medication_order_assist",
  "lab_interpretation",
  "close_encounter",
  "proactive_followup",
  "copilot_query",
  "clinical_summary",
  "soap_draft",
] as const satisfies readonly ClinicalAiTask[];

const bodySchema = z.object({
  task: z.enum(TASK_VALUES),
  message: z.string().max(8000).optional(),
  patientId: z.string().uuid().optional(),
  patientName: z.string().max(200).optional(),
  labSourceText: z.string().max(50000).optional(),
  assistContext: z.record(z.string(), z.unknown()).optional(),
  copilotContext: z.record(z.string(), z.unknown()).optional(),
  chart: z.record(z.string(), z.unknown()).optional(),
  lastConsultAt: z.string().nullable().optional(),
  enhanceWithLlm: z.boolean().optional(),
});

/** POST /api/clinical-ai — unified orchestrator endpoint (Phase F). */
export async function POST(request: Request) {
  const clinicId = await getActiveClinicId();
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

  const parsed = bodySchema.safeParse(json);
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
}

export async function GET() {
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
}

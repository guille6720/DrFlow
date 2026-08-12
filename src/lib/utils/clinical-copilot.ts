export {
  buildCopilotResponse,
  buildCopilotSuggestedPrompts,
  type ClinicalCopilotContext,
  type CopilotAction,
  type CopilotIntentId,
  type CopilotResponse,
  matchCopilotIntent,
} from "@/lib/utils/clinical-copilot-responses";
import type { GeminiStructuredResponse } from "@/lib/ai/gemini-structured-response";
import {
  type ClinicalAiAgentId,
  type ClinicalAiEngine,
  runClinicalAiOrchestrator,
} from "@/lib/utils/clinical-ai-orchestrator";
import type { ClinicalCopilotContext, CopilotResponse } from "@/lib/utils/clinical-copilot-responses";
import { matchCopilotIntent } from "@/lib/utils/clinical-copilot-responses";

export type { ClinicalAiAgentId, ClinicalAiEngine };

export type OrchestratedCopilotResponse = CopilotResponse & {
  agentId?: ClinicalAiAgentId;
  engine?: ClinicalAiEngine;
  structured?: GeminiStructuredResponse;
};

/** Run copilot query through the unified clinical AI orchestrator (Phase F). */
export function runClinicalCopilotQuery(
  message: string,
  ctx: ClinicalCopilotContext
): OrchestratedCopilotResponse {
  const result = runClinicalAiOrchestrator({
    task: "copilot_query",
    message,
    copilotContext: ctx,
    patientId: ctx.patientId,
    patientName: ctx.patientName,
    chart: ctx.chart,
    lastConsultAt: ctx.lastConsultAt,
    assistContext: ctx.assistContext,
  });

  return {
    intent: result.intent ?? matchCopilotIntent(message),
    title: result.title,
    body: result.body,
    actions: result.actions,
    agentId: result.agentId,
    engine: result.engine,
  };
}

export {
  matchCopilotIntent,
  buildCopilotResponse,
  buildCopilotSuggestedPrompts,
  type CopilotIntentId,
  type CopilotAction,
  type CopilotResponse,
  type ClinicalCopilotContext,
} from "@/lib/utils/clinical-copilot-responses";
import { matchCopilotIntent } from "@/lib/utils/clinical-copilot-responses";
import type { ClinicalCopilotContext, CopilotResponse } from "@/lib/utils/clinical-copilot-responses";
import {
  runClinicalAiOrchestrator,
  type ClinicalAiAgentId,
  type ClinicalAiEngine,
} from "@/lib/utils/clinical-ai-orchestrator";

export type { ClinicalAiAgentId, ClinicalAiEngine };

export type OrchestratedCopilotResponse = CopilotResponse & {
  agentId?: ClinicalAiAgentId;
  engine?: ClinicalAiEngine;
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

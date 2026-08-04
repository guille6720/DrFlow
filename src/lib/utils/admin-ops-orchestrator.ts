import {
  buildAdminOpsResponse,
  matchAdminOpsIntent,
  type AdminOpsIntentId,
  type AdminOpsAction,
} from "@/lib/utils/admin-ops-assistant";
import { ADMIN_OPS_DISCLAIMER } from "@/lib/utils/admin-ops-assistant";
import type { AdminOpsContext } from "@/lib/utils/admin-ops-types";

/** Admin/ops AI agents (Phase G). */
export type AdminOpsAgentId = "ops_agent" | "admin_agent";

export type AdminOpsTask =
  | "daily_ops_summary"
  | "waiting_queue"
  | "cash_help"
  | "admin_help"
  | "admin_ops_query";

export type AdminOpsEngine = "rule_based";

export type AdminOpsOrchestratorInput = {
  task: AdminOpsTask;
  message?: string;
  context?: AdminOpsContext;
};

export type AdminOpsOrchestratorResult = {
  agentId: AdminOpsAgentId;
  task: AdminOpsTask;
  title: string;
  body: string;
  actions: AdminOpsAction[];
  intent?: AdminOpsIntentId;
  engine: AdminOpsEngine;
  disclaimer: string;
};

export const ADMIN_OPS_AGENT_LABELS: Record<AdminOpsAgentId, string> = {
  ops_agent: "Operaciones del día",
  admin_agent: "Asistente administrativo",
};

const ADMIN_INTENTS: AdminOpsIntentId[] = ["open_caja", "cash_help", "admin_help"];

export function resolveAdminOpsAgentForIntent(intent: AdminOpsIntentId): AdminOpsAgentId {
  if (ADMIN_INTENTS.includes(intent)) return "admin_agent";
  return "ops_agent";
}

export function resolveAdminOpsAgentForTask(task: AdminOpsTask): AdminOpsAgentId {
  if (task === "cash_help" || task === "admin_help") return "admin_agent";
  return "ops_agent";
}

function runQueryAgent(input: AdminOpsOrchestratorInput): AdminOpsOrchestratorResult {
  const ctx = input.context ?? {};
  const message = input.message ?? "";
  const intent = matchAdminOpsIntent(message);
  const agentId = resolveAdminOpsAgentForIntent(intent);
  const response = buildAdminOpsResponse(intent, ctx);

  return {
    agentId,
    task: "admin_ops_query",
    title: response.title,
    body: response.body,
    actions: response.actions,
    intent: response.intent,
    engine: "rule_based",
    disclaimer: ADMIN_OPS_DISCLAIMER,
  };
}

/** Unified admin/ops orchestrator — routes to ops or admin agents (Phase G). */
export function runAdminOpsOrchestrator(
  input: AdminOpsOrchestratorInput
): AdminOpsOrchestratorResult {
  if (input.task === "admin_ops_query") {
    return runQueryAgent(input);
  }

  const ctx = input.context ?? {};
  const intentMap: Record<Exclude<AdminOpsTask, "admin_ops_query">, AdminOpsIntentId> = {
    daily_ops_summary: "daily_ops_summary",
    waiting_queue: "waiting_queue",
    cash_help: "cash_help",
    admin_help: "admin_help",
  };
  const intent = intentMap[input.task];
  const agentId = resolveAdminOpsAgentForTask(input.task);
  const response = buildAdminOpsResponse(intent, ctx);

  return {
    agentId,
    task: input.task,
    title: response.title,
    body: response.body,
    actions: response.actions,
    intent: response.intent,
    engine: "rule_based",
    disclaimer: ADMIN_OPS_DISCLAIMER,
  };
}

export function listAdminOpsAgents(): Array<{ id: AdminOpsAgentId; label: string }> {
  return (Object.keys(ADMIN_OPS_AGENT_LABELS) as AdminOpsAgentId[]).map((id) => ({
    id,
    label: ADMIN_OPS_AGENT_LABELS[id],
  }));
}

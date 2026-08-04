import {
  buildAdminOpsResponse,
  matchAdminOpsIntent,
  type AdminOpsIntentId,
  type AdminOpsAction,
} from "@/features/dashboard/utils/admin-ops-assistant";
import { ADMIN_OPS_DISCLAIMER } from "@/features/dashboard/utils/admin-ops-assistant";
import type { AdminOpsContext } from "@/features/dashboard/utils/admin-ops-types";

/** Admin/ops AI agents (Phase G/H). */
export type AdminOpsAgentId = "ops_agent" | "admin_agent" | "analytics_agent";

export type AdminOpsTask =
  | "daily_ops_summary"
  | "waiting_queue"
  | "cash_help"
  | "admin_help"
  | "revenue_today"
  | "revenue_month"
  | "authorizations_list"
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
  analytics_agent: "Analytics e ingresos",
};

const ADMIN_INTENTS: AdminOpsIntentId[] = ["open_caja", "cash_help", "admin_help"];

const ANALYTICS_INTENTS: AdminOpsIntentId[] = [
  "revenue_today",
  "revenue_month",
  "payment_breakdown",
  "closure_status",
  "authorizations_list",
  "copago_summary",
];

export function resolveAdminOpsAgentForIntent(intent: AdminOpsIntentId): AdminOpsAgentId {
  if (ANALYTICS_INTENTS.includes(intent)) return "analytics_agent";
  if (ADMIN_INTENTS.includes(intent)) return "admin_agent";
  return "ops_agent";
}

export function resolveAdminOpsAgentForTask(task: AdminOpsTask): AdminOpsAgentId {
  if (task === "cash_help" || task === "admin_help") return "admin_agent";
  if (task === "revenue_today" || task === "revenue_month" || task === "authorizations_list") {
    return "analytics_agent";
  }
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
    revenue_today: "revenue_today",
    revenue_month: "revenue_month",
    authorizations_list: "authorizations_list",
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

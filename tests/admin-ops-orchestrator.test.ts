import { describe, expect, it } from "vitest";

import {
  ADMIN_OPS_AGENT_LABELS,
  listAdminOpsAgents,
  resolveAdminOpsAgentForIntent,
  resolveAdminOpsAgentForTask,
  runAdminOpsOrchestrator,
} from "@/features/dashboard/utils/admin-ops-orchestrator";
import { buildAdminOpsSnapshotFromDashboard } from "@/features/dashboard/utils/admin-ops-types";
import type { ClinicalOperationsDashboardPayload } from "@/features/dashboard/utils/clinical-operations-dashboard-types";

const opsPayload: ClinicalOperationsDashboardPayload = {
  waiting: [],
  upcoming: [],
  overdue: [{ id: "a1", start_at: "2026-08-04T10:00:00.000Z", waiting_room_status: null, status: "confirmed", patient_id: "p1", patients: { first_name: "Juan", last_name: "Pérez", document_number: "1" } }],
  draftPrescriptions: [],
  pendingStudies: [],
  criticalPatients: [],
  notifications: [],
  todayAppointments: [],
  tasks: [],
};

describe("admin-ops-orchestrator", () => {
  it("listAdminOpsAgents returns ops, admin, and analytics agents", () => {
    const agents = listAdminOpsAgents();
    expect(agents.length).toBe(3);
    expect(ADMIN_OPS_AGENT_LABELS.analytics_agent).toContain("ingresos");
  });

  it("resolveAdminOpsAgentForIntent routes revenue to analytics agent", () => {
    expect(resolveAdminOpsAgentForIntent("revenue_today")).toBe("analytics_agent");
    expect(resolveAdminOpsAgentForIntent("cash_help")).toBe("admin_agent");
  });

  it("resolveAdminOpsAgentForTask maps tasks", () => {
    expect(resolveAdminOpsAgentForTask("daily_ops_summary")).toBe("ops_agent");
    expect(resolveAdminOpsAgentForTask("cash_help")).toBe("admin_agent");
  });

  it("runAdminOpsOrchestrator query routes waiting queue", () => {
    const snap = buildAdminOpsSnapshotFromDashboard(opsPayload);
    const result = runAdminOpsOrchestrator({
      task: "admin_ops_query",
      message: "cola de espera",
      context: { ops: snap },
    });
    expect(result.agentId).toBe("ops_agent");
    expect(result.intent).toBe("waiting_queue");
    expect(result.engine).toBe("rule_based");
  });

  it("runAdminOpsOrchestrator daily_ops_summary task", () => {
    const snap = buildAdminOpsSnapshotFromDashboard(opsPayload);
    const result = runAdminOpsOrchestrator({
      task: "daily_ops_summary",
      context: { ops: snap },
    });
    expect(result.body).toContain("Turnos demorados: 1");
  });

  it("runAdminOpsOrchestrator revenue query uses analytics agent", () => {
    const result = runAdminOpsOrchestrator({
      task: "admin_ops_query",
      message: "ingresos de hoy",
      context: {
        analytics: {
          dateLabel: "2026-08-04",
          todayTotal: 50000,
          todayChargeCount: 3,
          monthTotal: 200000,
          monthChargeCount: 10,
          copagoTotal: 0,
          coseguroTotal: 0,
          closureClosedToday: false,
          paymentBreakdown: [],
          chargeKindBreakdown: [],
          attentionBreakdown: [],
          authorizationCount: 0,
          recentAuthorizations: [],
        },
      },
    });
    expect(result.agentId).toBe("analytics_agent");
    expect(result.intent).toBe("revenue_today");
  });
});

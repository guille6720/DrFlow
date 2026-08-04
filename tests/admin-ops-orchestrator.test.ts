import { describe, expect, it } from "vitest";
import {
  ADMIN_OPS_AGENT_LABELS,
  listAdminOpsAgents,
  resolveAdminOpsAgentForIntent,
  resolveAdminOpsAgentForTask,
  runAdminOpsOrchestrator,
} from "@/lib/utils/admin-ops-orchestrator";
import { buildAdminOpsSnapshotFromDashboard } from "@/lib/utils/admin-ops-types";
import type { ClinicalOperationsDashboardPayload } from "@/lib/utils/clinical-operations-dashboard-types";

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
  it("listAdminOpsAgents returns ops and admin agents", () => {
    const agents = listAdminOpsAgents();
    expect(agents.length).toBe(2);
    expect(ADMIN_OPS_AGENT_LABELS.ops_agent).toContain("Operaciones");
  });

  it("resolveAdminOpsAgentForIntent routes cash to admin agent", () => {
    expect(resolveAdminOpsAgentForIntent("cash_help")).toBe("admin_agent");
    expect(resolveAdminOpsAgentForIntent("waiting_queue")).toBe("ops_agent");
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
});

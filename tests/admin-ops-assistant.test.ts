import { describe, expect, it } from "vitest";
import {
  buildAdminOpsResponse,
  buildAdminOpsSuggestedPrompts,
  matchAdminOpsIntent,
} from "@/lib/utils/admin-ops-assistant";
import { buildAdminOpsSnapshotFromDashboard } from "@/lib/utils/admin-ops-types";
import type { ClinicalOperationsDashboardPayload } from "@/lib/utils/clinical-operations-dashboard-types";
import type { AdminAnalyticsSnapshot } from "@/lib/utils/admin-analytics-types";

const analyticsStub: AdminAnalyticsSnapshot = {
  dateLabel: "2026-08-04",
  todayTotal: 125000,
  todayChargeCount: 8,
  monthTotal: 890000,
  monthChargeCount: 42,
  copagoTotal: 15000,
  coseguroTotal: 8000,
  closureClosedToday: false,
  paymentBreakdown: [{ code: "cash", label: "Efectivo", amount: 80000 }],
  chargeKindBreakdown: [],
  attentionBreakdown: [{ code: "obra_social", label: "Obra Social", amount: 23000 }],
  authorizationCount: 1,
  recentAuthorizations: [{ title: "OSDE", patientName: "Pérez, Juan", createdAt: "2026-08-04T10:00:00.000Z" }],
};

const opsStub: ClinicalOperationsDashboardPayload = {
  waiting: [
    {
      id: "a1",
      start_at: "2026-08-04T14:00:00.000Z",
      waiting_room_status: "waiting",
      status: "confirmed",
      patient_id: "p1",
      patients: { first_name: "Juan", last_name: "Pérez", document_number: "123" },
    },
  ],
  upcoming: [],
  overdue: [{ id: "a2", start_at: "2026-08-04T12:00:00.000Z", waiting_room_status: null, status: "confirmed", patient_id: "p2", patients: { first_name: "Ana", last_name: "Gómez", document_number: "456" } }],
  draftPrescriptions: [{ id: "rx1", created_at: "2026-08-04T10:00:00.000Z", patient_id: "p1", patients: { first_name: "Juan", last_name: "Pérez", document_number: "123" } }],
  pendingStudies: [],
  criticalPatients: [],
  notifications: [{ id: "n1", kind: "no_show", label: "Ausente", at: "2026-08-04T11:00:00.000Z", patientName: "López", href: "/agenda" }],
  todayAppointments: [],
  tasks: [
    {
      id: "t1",
      kind: "overdue_appointment",
      label: "Atender turno demorado",
      detail: "Pérez, Juan",
      at: "2026-08-04T12:00:00.000Z",
      href: "/pacientes/p1",
      priority: "high",
    },
  ],
};

describe("admin-ops-assistant", () => {
  it("matchAdminOpsIntent detects daily summary", () => {
    expect(matchAdminOpsIntent("Resumen del día")).toBe("daily_ops_summary");
  });

  it("matchAdminOpsIntent detects waiting queue", () => {
    expect(matchAdminOpsIntent("¿Quién está en espera?")).toBe("waiting_queue");
  });

  it("matchAdminOpsIntent detects cash help", () => {
    expect(matchAdminOpsIntent("cerrar caja")).toBe("cash_help");
  });

  it("buildAdminOpsSnapshotFromDashboard aggregates counts", () => {
    const snap = buildAdminOpsSnapshotFromDashboard(opsStub);
    expect(snap.waitingCount).toBe(1);
    expect(snap.overdueCount).toBe(1);
    expect(snap.draftPrescriptionsCount).toBe(1);
    expect(snap.highPriorityTasksCount).toBe(1);
  });

  it("buildAdminOpsResponse daily summary with ops context", () => {
    const snap = buildAdminOpsSnapshotFromDashboard(opsStub);
    const res = buildAdminOpsResponse("daily_ops_summary", { ops: snap, page: "dashboard" });
    expect(res.body).toContain("Cola de espera");
    expect(res.body).toContain("Turnos demorados");
  });

  it("buildAdminOpsResponse help without ops context", () => {
    const res = buildAdminOpsResponse("waiting_queue", {});
    expect(res.intent).toBe("admin_help");
    expect(res.title).toBe("Sin datos operativos");
  });

  it("buildAdminOpsSuggestedPrompts adapts to context", () => {
    const withOps = buildAdminOpsSuggestedPrompts({ ops: buildAdminOpsSnapshotFromDashboard(opsStub) });
    expect(withOps.some((p) => p.toLowerCase().includes("espera"))).toBe(true);
    const without = buildAdminOpsSuggestedPrompts({});
    expect(without.length).toBeGreaterThan(0);
  });

  it("buildAdminOpsResponse cash help respects permissions", () => {
    const denied = buildAdminOpsResponse("open_caja", { canManageCash: false });
    expect(denied.body).toContain("permisos");
    const allowed = buildAdminOpsResponse("open_caja", { canManageCash: true });
    expect(allowed.actions.some((a) => a.href === "/caja")).toBe(true);
  });

  it("buildAdminOpsResponse covers ops intents", () => {
    const snap = buildAdminOpsSnapshotFromDashboard(opsStub);
    const ctx = { ops: snap };
    expect(buildAdminOpsResponse("waiting_queue", ctx).body).toContain("Pérez");
    expect(buildAdminOpsResponse("overdue_appointments", ctx).body).toContain("turno");
    expect(buildAdminOpsResponse("pending_prescriptions", ctx).body).toContain("receta");
    expect(buildAdminOpsResponse("pending_studies", ctx).body).toContain("estudio");
    expect(buildAdminOpsResponse("tasks_list", ctx).body).toContain("Atender");
    expect(buildAdminOpsResponse("notifications", ctx).body).toContain("Ausente");
  });

  it("buildAdminOpsResponse covers analytics intents", () => {
    const ctx = { analytics: analyticsStub };
    expect(buildAdminOpsResponse("revenue_month", ctx).body).toContain("890");
    expect(buildAdminOpsResponse("payment_breakdown", ctx).body).toContain("Efectivo");
    expect(buildAdminOpsResponse("copago_summary", ctx).body).toContain("Copagos");
    expect(buildAdminOpsResponse("authorizations_list", ctx).body).toContain("OSDE");
  });

  it("buildAdminOpsResponse navigation intents", () => {
    expect(buildAdminOpsResponse("open_waiting_room", {}).actions[0]?.href).toBe("/sala-espera");
    expect(buildAdminOpsResponse("open_agenda", {}).actions[0]?.href).toContain("/agenda");
    expect(buildAdminOpsResponse("cash_help", { canManageCash: true }).body).toContain("Caja");
    expect(buildAdminOpsResponse("admin_help", {}).title).toBe("Asistente operativo");
  });

  it("matchAdminOpsIntent covers Phase H patterns", () => {
    expect(matchAdminOpsIntent("ingresos del mes")).toBe("revenue_month");
    expect(matchAdminOpsIntent("desglose por método de pago")).toBe("payment_breakdown");
    expect(matchAdminOpsIntent("estado del cierre")).toBe("closure_status");
    expect(matchAdminOpsIntent("copagos")).toBe("copago_summary");
  });

  it("buildAdminOpsSuggestedPrompts includes analytics prompts", () => {
    const prompts = buildAdminOpsSuggestedPrompts({ analytics: analyticsStub });
    expect(prompts.some((p) => p.toLowerCase().includes("ingresos"))).toBe(true);
  });
});

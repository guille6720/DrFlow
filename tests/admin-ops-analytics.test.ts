import { describe, expect, it } from "vitest";
import {
  buildAdminOpsResponse,
  matchAdminOpsIntent,
} from "@/features/dashboard/utils/admin-ops-assistant";
import {
  formatBreakdownLines,
  formatCurrencyAr,
  type AdminAnalyticsSnapshot,
} from "@/lib/utils/admin-analytics-types";

const analyticsStub: AdminAnalyticsSnapshot = {
  dateLabel: "2026-08-04",
  todayTotal: 125000,
  todayChargeCount: 8,
  monthTotal: 890000,
  monthChargeCount: 42,
  copagoTotal: 15000,
  coseguroTotal: 8000,
  closureClosedToday: false,
  paymentBreakdown: [
    { code: "cash", label: "Efectivo", amount: 80000 },
    { code: "transfer", label: "Transferencia", amount: 45000 },
  ],
  chargeKindBreakdown: [
    { code: "consulta_particular", label: "Consulta Particular", amount: 100000 },
    { code: "copago_autorizado", label: "Copago autorizado", amount: 15000 },
  ],
  attentionBreakdown: [{ code: "obra_social", label: "Obra Social", amount: 23000 }],
  authorizationCount: 2,
  recentAuthorizations: [
    { title: "Autorización OSDE", patientName: "Pérez, Juan", createdAt: "2026-08-04T10:00:00.000Z" },
  ],
};

describe("admin-analytics Phase H", () => {
  it("matchAdminOpsIntent detects revenue today", () => {
    expect(matchAdminOpsIntent("Ingresos de hoy")).toBe("revenue_today");
    expect(matchAdminOpsIntent("cuánto cobramos")).toBe("revenue_today");
  });

  it("matchAdminOpsIntent detects authorizations", () => {
    expect(matchAdminOpsIntent("listar autorizaciones")).toBe("authorizations_list");
  });

  it("formatCurrencyAr formats AR locale", () => {
    expect(formatCurrencyAr(125000)).toContain("125");
  });

  it("formatBreakdownLines skips zero rows", () => {
    const lines = formatBreakdownLines([
      { code: "cash", label: "Efectivo", amount: 100 },
      { code: "qr", label: "QR", amount: 0 },
    ]);
    expect(lines).toContain("Efectivo");
    expect(lines).not.toContain("QR");
  });

  it("buildAdminOpsResponse revenue_today with analytics", () => {
    const res = buildAdminOpsResponse("revenue_today", { analytics: analyticsStub });
    expect(res.body).toContain("125");
    expect(res.actions.some((a) => a.href === "/caja/reportes")).toBe(true);
  });

  it("buildAdminOpsResponse revenue without analytics prompts help", () => {
    const res = buildAdminOpsResponse("revenue_today", {});
    expect(res.title).toBe("Sin datos de caja");
  });

  it("buildAdminOpsResponse closure status", () => {
    const open = buildAdminOpsResponse("closure_status", { analytics: analyticsStub });
    expect(open.body).toContain("abierta");
    const closed = buildAdminOpsResponse("closure_status", {
      analytics: { ...analyticsStub, closureClosedToday: true },
    });
    expect(closed.body).toContain("cerrada");
  });

  it("buildAdminOpsResponse daily summary merges ops and analytics", () => {
    const res = buildAdminOpsResponse("daily_ops_summary", {
      analytics: analyticsStub,
      ops: {
        waitingCount: 2,
        overdueCount: 0,
        draftPrescriptionsCount: 0,
        pendingStudiesCount: 0,
        tasksCount: 1,
        highPriorityTasksCount: 0,
        notificationsCount: 0,
        criticalPatientsCount: 0,
        waiting: [],
        tasks: [],
        notifications: [],
      },
    });
    expect(res.body).toContain("Cola de espera");
    expect(res.body).toContain("Ingresos hoy");
  });
});

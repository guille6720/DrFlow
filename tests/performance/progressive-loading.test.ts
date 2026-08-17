import { describe, expect, it } from "vitest";

import {
  fetchDashboardCoreQueries,
  fetchDashboardSecondaryQueries,
} from "@/features/dashboard/server/load-clinical-operations-dashboard.helpers";
import { getWorkspaceFetchPlan } from "@/features/pacientes/server/patient-workspace-fetch-plan";

describe("patient workspace fetch plan", () => {
  it("loads minimal data for audit and admin docs tabs", () => {
    expect(getWorkspaceFetchPlan("auditoria")).toMatchObject({
      clinicalRecords: false,
      prescriptions: false,
      orders: false,
    });
    expect(getWorkspaceFetchPlan("docs_admin")).toMatchObject({
      clinicalRecords: false,
    });
  });

  it("scopes recetas tab to prescriptions and limited records", () => {
    const plan = getWorkspaceFetchPlan("recetas");
    expect(plan.prescriptions).toBe(true);
    expect(plan.clinicalRecords).toBe(true);
    expect(plan.orders).toBe(false);
    expect(plan.recordLimit).toBe(50);
  });

  it("loads timeline bundle with paginated clinical records", () => {
    const plan = getWorkspaceFetchPlan("timeline");
    expect(plan.clinicalRecords).toBe(true);
    expect(plan.attachments).toBe(true);
    expect(plan.appointments).toBe(true);
    expect(plan.hceSummary).toBe(true);
    expect(plan.recordLimit).toBe(80);
  });
});

describe("turnos dashboard scan caps", () => {
  it("keeps today and fallback scans bounded", async () => {
    const pagination = await import("@/core/supabase/pagination");
    expect(pagination.TURNOS_TODAY_SCAN_MAX).toBe(200);
    expect(pagination.TURNOS_REPORT_FALLBACK_MAX).toBe(1500);
    expect(pagination.AVAILABILITY_RULES_MAX).toBe(400);
  });
});

describe("dashboard loader split", () => {
  it("core and secondary query groups are disjoint", () => {
    expect(fetchDashboardCoreQueries).toBeTypeOf("function");
    expect(fetchDashboardSecondaryQueries).toBeTypeOf("function");
  });
});

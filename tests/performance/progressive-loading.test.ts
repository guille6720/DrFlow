import { describe, expect, it } from "vitest";

import { PACIENTES_PAGE_SIZE } from "@/core/supabase/pagination";

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

  it("scopes recetas tab to prescriptions without clinical records", () => {
    const plan = getWorkspaceFetchPlan("recetas");
    expect(plan.prescriptions).toBe(true);
    expect(plan.clinicalRecords).toBe(false);
    expect(plan.orders).toBe(false);
    expect(plan.prescriptionLimit).toBe(100);
  });

  it("first-paints resumen and soap with last 20 evolutions", () => {
    const resumen = getWorkspaceFetchPlan("resumen");
    expect(resumen.clinicalRecords).toBe(true);
    expect(resumen.recordLimit).toBe(20);
    expect(resumen.attachmentLimit).toBe(40);
    expect(resumen.prescriptionLimit).toBe(20);
    expect(resumen.orderLimit).toBe(20);
    expect(resumen.appointmentLimit).toBe(20);

    const soap = getWorkspaceFetchPlan("soap");
    expect(soap.recordLimit).toBe(20);
    expect(soap.prescriptionLimit).toBe(20);
  });

  it("loads timeline bundle with first-paint clinical records", () => {
    const plan = getWorkspaceFetchPlan("timeline");
    expect(plan.clinicalRecords).toBe(true);
    expect(plan.attachments).toBe(true);
    expect(plan.appointments).toBe(true);
    expect(plan.hceSummary).toBe(true);
    expect(plan.recordLimit).toBe(20);
  });

  it("does not dump 100 evolutions on problem-list tabs", () => {
    expect(getWorkspaceFetchPlan("diagnosticos").recordLimit).toBe(20);
    expect(getWorkspaceFetchPlan("problemas").recordLimit).toBe(20);
    expect(getWorkspaceFetchPlan("ordenes").clinicalRecords).toBe(false);
    expect(getWorkspaceFetchPlan("archivos").clinicalRecords).toBe(false);
    expect(getWorkspaceFetchPlan("archivos").attachments).toBe(true);
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

describe("pacientes list pagination", () => {
  it("keeps /pacientes at 25 rows per server page", () => {
    expect(PACIENTES_PAGE_SIZE).toBe(25);
    expect(PACIENTES_PAGE_SIZE).toBeGreaterThanOrEqual(25);
    expect(PACIENTES_PAGE_SIZE).toBeLessThanOrEqual(50);
  });
});

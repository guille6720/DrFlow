import { describe, expect, it } from "vitest";

import {
  CLINIC_JOB_REGISTRY,
  getClinicJobDefinition,
  JOB_STATUS_LABELS,
  listClinicJobTypes,
} from "@/core/jobs/registry";

describe("clinic job registry", () => {
  it("lists job types with definitions", () => {
    const types = listClinicJobTypes();
    expect(types.length).toBeGreaterThanOrEqual(7);
    for (const t of CLINIC_JOB_REGISTRY) {
      expect(getClinicJobDefinition(t.id).label.length).toBeGreaterThan(0);
    }
  });

  it("includes async domains from Phase 15", () => {
    const ids = listClinicJobTypes().map((t) => t.id);
    expect(ids).toContain("send_reminder");
    expect(ids).toContain("generate_report");
    expect(ids).toContain("import_clinical_pdf");
    expect(ids).toContain("import_hce_batch");
    expect(ids).toContain("import_patients_batch");
    expect(ids).toContain("run_ai_task");
    expect(ids).toContain("export_clinical_bulk");
  });

  it("has status labels", () => {
    expect(JOB_STATUS_LABELS.pending).toBe("En cola");
    expect(JOB_STATUS_LABELS.completed).toBe("Completado");
  });
});

describe("051_clinic_jobs_phase15 migration", () => {
  it("creates clinic_jobs table and worker RPCs", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/051_clinic_jobs_phase15.sql"),
      "utf8"
    );
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS clinic_jobs/);
    expect(sql).toMatch(/claim_clinic_jobs/);
    expect(sql).toMatch(/complete_clinic_job/);
  });
});

describe("SECURITY_DEFINER_RPC_CHECKS manifest", () => {
  it("includes worker RPCs", async () => {
    const { SECURITY_DEFINER_RPC_CHECKS } = await import("@/core/security/rls-manifest");
    const names = SECURITY_DEFINER_RPC_CHECKS.map((r) => r.name);
    expect(names).toContain("claim_clinic_jobs");
    expect(names).toContain("complete_clinic_job");
  });
});

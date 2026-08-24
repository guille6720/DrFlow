import { readdirSync, readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  evaluateTenantIsolationPosture,
  TENANT_BOUNDARY,
  TENANT_ISOLATION_CHECKS,
  wouldCrossTenantLeak,
} from "@/core/compliance/tenant-isolation";
import { TABLES_REQUIRING_RLS } from "@/core/security/rls-manifest";
import { CLINIC_SCOPED_TABLES } from "@/core/security/tenant-scope";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function allMigrations(): string {
  const dir = resolve(ROOT, "supabase/migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(resolve(dir, f), "utf8"))
    .join("\n");
}

describe("tenant-isolation policy module", () => {
  it("uses clinic_id as tenant boundary", () => {
    expect(TENANT_BOUNDARY).toBe("clinic_id");
    expect(evaluateTenantIsolationPosture().boundary).toBe("clinic_id");
  });

  it("covers PHASE 10 blocker surfaces", () => {
    const ids = TENANT_ISOLATION_CHECKS.map((c) => c.id);
    expect(ids).toContain("rls_core_phi");
    expect(ids).toContain("public_api_rpc_gate");
    expect(ids).toContain("ai_patient_scope");
    expect(ids).toContain("storage_path_prefix");
    expect(ids).toContain("exports_ownership");
  });

  it("wouldCrossTenantLeak detects Clinic A vs B mismatch", () => {
    const a = "11111111-1111-1111-1111-111111111111";
    const b = "22222222-2222-2222-2222-222222222222";
    expect(wouldCrossTenantLeak(a, a)).toBe(false);
    expect(wouldCrossTenantLeak(a, b)).toBe(true);
    expect(wouldCrossTenantLeak(a, null)).toBe(true);
  });
});

describe("133_tenant_isolation_public_api migration", () => {
  const sql = read("supabase/migrations/133_tenant_isolation_public_api.sql");

  it("defines assert_public_api_clinic_access with service_role + membership", () => {
    expect(sql).toMatch(/assert_public_api_clinic_access/);
    expect(sql).toMatch(/auth\.role\(\).*service_role/);
    expect(sql).toMatch(/user_role_in_clinic\(p_clinic_id\)/);
    expect(sql).toMatch(/RAISE EXCEPTION 'FORBIDDEN'/);
  });

  it("gates all public API SECURITY DEFINER RPCs", () => {
    expect(sql).toMatch(/api_list_appointments[\s\S]*assert_public_api_clinic_access/);
    expect(sql).toMatch(/api_get_appointment[\s\S]*assert_public_api_clinic_access/);
    expect(sql).toMatch(/api_list_professionals[\s\S]*assert_public_api_clinic_access/);
    expect(sql).toMatch(/api_get_booking_occupancy[\s\S]*assert_public_api_clinic_access/);
    expect(sql).toMatch(/api_submit_appointment[\s\S]*assert_public_api_clinic_access/);
  });

  it("grants EXECUTE to service_role for admin client public API", () => {
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.api_list_appointments[\s\S]*service_role/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.api_submit_appointment[\s\S]*service_role/);
  });
});

describe("RLS manifest Phase 10 completeness", () => {
  it("includes tables previously missing from CI (103–129)", () => {
    expect(TABLES_REQUIRING_RLS).toContain("clinic_api_keys");
    expect(TABLES_REQUIRING_RLS).toContain("os_fee_schedules");
    expect(TABLES_REQUIRING_RLS).toContain("data_import_sessions");
    expect(TABLES_REQUIRING_RLS).toContain("commercial_usage_thresholds");
  });

  it("CLINIC_SCOPED_TABLES includes API and OS liquidation tables", () => {
    expect(CLINIC_SCOPED_TABLES).toContain("clinic_api_keys");
    expect(CLINIC_SCOPED_TABLES).toContain("os_liquidation_batches");
  });
});

describe("cross-tenant surface coverage (static)", () => {
  it("public API binds RPC clinic_id to API key clinic", () => {
    const src = read("src/app/api/v1/appointments/route.ts");
    expect(src).toMatch(/p_clinic_id:\s*auth\.clinicId/);
    expect(src).toContain("withPublicApiRoute");
  });

  it("authenticatePublicApiKey loads clinic_id from key hash", () => {
    const src = read("src/core/public-api/auth.ts");
    expect(src).toContain("clinic_api_keys");
    expect(src).toMatch(/clinicId:\s*row\.clinic_id/);
  });

  it("patients search API requires active clinic and scopes search", () => {
    const src = read("src/app/api/patients/search/route.ts");
    expect(src).toContain("getActiveClinicId");
    expect(src).toContain("searchPatientsForClinic");
    expect(src).toMatch(/clinicId/);
  });

  it("clinical-ai verifies patient belongs to active clinic", () => {
    const src = read("src/app/api/clinical-ai/route.ts");
    expect(src).toContain("verifyPatientInClinic");
    expect(src).toContain("getActiveClinicId");
  });

  it("AI identifier loader filters by clinic_id", () => {
    const src = read("src/lib/ai/patient-ai-identifiers.server.ts");
    expect(src).toMatch(/eq\("id", patientId\)[\s\S]*eq\("clinic_id", clinicId\)/);
  });

  it("signed clinical downloads assert storage path prefix", () => {
    const clinical = read("src/features/pacientes/actions/patient-attachments.ts");
    const admin = read("src/lib/actions/admin-documents.ts");
    expect(clinical).toContain("assertStoragePathInClinic");
    expect(admin).toContain("assertStoragePathInClinic");
  });

  it("exports verify ownership and storage prefix", () => {
    const clinicalExport = read("src/features/integraciones/actions/patient-clinical-export.ts");
    const staging = read("src/lib/server/export-staging.ts");
    const pack = read("src/features/integraciones/server/pack-clinical-export-zip.ts");
    expect(clinicalExport).toContain("verifyPatientInClinic");
    expect(staging).toContain("assertStoragePathInClinic");
    expect(pack).toContain("assertStoragePathInClinic");
  });

  it("job handlers assert storage path for imports", () => {
    const pdf = read("src/core/jobs/handlers/import-clinical-pdf.ts");
    const batch = read("src/core/jobs/handlers/import-batch.ts");
    expect(pdf).toContain("assertStoragePathInClinic");
    expect(batch).toContain("assertStoragePathInClinic");
  });

  it("clinical-reset admin deletes are scoped by clinic_id", () => {
    const src = read("src/lib/actions/clinical-reset.ts");
    expect(src).toMatch(/\.delete\(\)[\s\S]*eq\("clinic_id", clinicId\)/);
  });
});

describe("SECURITY DEFINER public API cannot omit tenant gate (regression)", () => {
  it("latest migration body for api_list_appointments includes assert", () => {
    const sql = allMigrations();
    const lastIdx = sql.lastIndexOf("CREATE OR REPLACE FUNCTION public.api_list_appointments");
    expect(lastIdx).toBeGreaterThan(-1);
    const slice = sql.slice(lastIdx, lastIdx + 2500);
    expect(slice).toContain("assert_public_api_clinic_access");
  });
});

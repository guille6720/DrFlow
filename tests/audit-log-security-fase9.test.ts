import { readdirSync, readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  AUDIT_LOG_SECURITY_POLICY,
  evaluateAuditLogSecurityPosture,
  SENSITIVE_AUDIT_CATEGORIES,
} from "@/core/compliance/audit-log-security";

const ROOT = process.cwd();

function readMigration(name: string): string {
  return readFileSync(resolve(ROOT, "supabase/migrations", name), "utf8");
}

function allMigrationSql(): string {
  return readdirSync(resolve(ROOT, "supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(resolve(ROOT, "supabase/migrations", f), "utf8"))
    .join("\n");
}

describe("132_audit_log_security migration", () => {
  const sql = readMigration("132_audit_log_security.sql");

  it("forces server-owned timestamps on INSERT", () => {
    expect(sql).toMatch(/enforce_audit_insert_integrity/);
    expect(sql).toMatch(/audit_logs_insert_integrity/);
    expect(sql).toMatch(/clinical_record_audit_insert_integrity/);
    expect(sql).toMatch(/NEW\.created_at := now\(\)/);
    expect(sql).toMatch(/NEW\.changed_at := now\(\)/);
  });

  it("binds clinical_record_audit authorship to auth.uid()", () => {
    expect(sql).toMatch(/clinical_record_audit_insert[\s\S]*changed_by = auth\.uid\(\)/);
    expect(sql).toMatch(/can_write_clinical\(clinic_id\)/);
  });

  it("revokes UPDATE/DELETE from app roles", () => {
    expect(sql).toMatch(/REVOKE UPDATE, DELETE ON audit_logs FROM authenticated/);
    expect(sql).toMatch(/REVOKE UPDATE, DELETE ON clinical_record_audit FROM authenticated/);
  });
});

describe("audit log RLS final state", () => {
  const sql = allMigrationSql();

  it("audit_logs INSERT requires auth.uid() and tenant membership", () => {
    expect(sql).toMatch(/audit_logs_insert[\s\S]*user_id = auth\.uid\(\)/);
    expect(sql).toMatch(/audit_logs_insert[\s\S]*user_clinic_ids\(\)/);
  });

  it("has no UPDATE or DELETE policies on audit tables", () => {
    expect(sql).not.toMatch(/CREATE POLICY audit_logs_update/);
    expect(sql).not.toMatch(/CREATE POLICY audit_logs_delete/);
    expect(sql).not.toMatch(/CREATE POLICY clinical_record_audit_update/);
    expect(sql).not.toMatch(/CREATE POLICY clinical_record_audit_delete/);
  });

  it("retains immutability triggers from 048/055", () => {
    expect(sql).toMatch(/audit_logs_immutable/);
    expect(sql).toMatch(/clinical_record_audit_immutable/);
    expect(sql).toMatch(/prevent_audit_mutation/);
  });
});

describe("audit-log-security policy module", () => {
  it("defines immutable tables and authorship binding", () => {
    expect(AUDIT_LOG_SECURITY_POLICY.immutable).toBe(true);
    expect(AUDIT_LOG_SECURITY_POLICY.tables).toContain("audit_logs");
    expect(AUDIT_LOG_SECURITY_POLICY.authorshipBinding.audit_logs).toContain("auth.uid()");
  });

  it("covers PHASE 9 sensitive operation categories", () => {
    const ids = SENSITIVE_AUDIT_CATEGORIES.map((c) => c.id);
    expect(ids).toContain("view_patient_clinical");
    expect(ids).toContain("sensitive_download");
    expect(ids).toContain("exports");
    expect(ids).toContain("prescriptions");
    expect(ids).toContain("permissions");
    expect(ids).toContain("ai_usage");
  });

  it("evaluateAuditLogSecurityPosture returns expected flags", () => {
    const status = evaluateAuditLogSecurityPosture();
    expect(status.immutable).toBe(true);
    expect(status.authorshipBound).toBe(true);
    expect(status.sensitiveCategories).toBeGreaterThanOrEqual(8);
  });
});

describe("sensitive operation app coverage (Phase 9)", () => {
  const checks: Array<{ file: string; mustContain: string[] }> = [
    {
      file: "src/core/security/sensitive-access-audit.ts",
      mustContain: ["recordSensitiveAccess", "action: \"view\""],
    },
    {
      file: "src/features/pacientes/actions/patient-attachments.ts",
      mustContain: ["getPatientClinicalDocumentUrl", "recordAudit"],
    },
    {
      file: "src/lib/actions/admin-documents.ts",
      mustContain: ["getAdminDocumentUrl", "recordAudit"],
    },
    {
      file: "src/lib/actions/compliance.ts",
      mustContain: ["exportPatientArcoBundle", "logAudit"],
    },
    {
      file: "src/features/integraciones/actions/patient-clinical-export.ts",
      mustContain: ["recordAudit"],
    },
    {
      file: "src/core/compliance/ai-audit.ts",
      mustContain: ["recordAiAuditEvent", "buildAiAuditRecordParams"],
    },
    {
      file: "src/lib/actions/invitations.ts",
      mustContain: ["recordAudit", "updateClinicMemberRole"],
    },
    {
      file: "src/features/recetas/actions/prescriptions.ts",
      mustContain: ["recordAudit", "issuePrescription"],
    },
  ];

  for (const { file, mustContain } of checks) {
    it(`${file} implements sensitive audit signals`, () => {
      const content = readFileSync(resolve(ROOT, file), "utf8");
      for (const needle of mustContain) {
        expect(content).toContain(needle);
      }
    });
  }
});

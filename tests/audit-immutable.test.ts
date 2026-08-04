import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  auditFieldChanges,
  auditModuleLabel,
  buildAuditLogRow,
  buildAuditWhat,
  deriveAuditModule,
} from "@/core/security/audit-log";

describe("055_immutable_audit_logging migration", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/055_immutable_audit_logging.sql"),
    "utf8"
  );

  it("adds module and what columns", () => {
    expect(sql).toMatch(/audit_logs[\s\S]*ADD COLUMN IF NOT EXISTS module TEXT/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS what TEXT/);
    expect(sql).toMatch(/clinical_record_audit[\s\S]*ADD COLUMN IF NOT EXISTS module TEXT/);
  });

  it("re-asserts immutability and revokes TRUNCATE", () => {
    expect(sql).toMatch(/prevent_audit_mutation/);
    expect(sql).toMatch(/REVOKE TRUNCATE ON audit_logs/);
    expect(sql).toMatch(/REVOKE TRUNCATE ON clinical_record_audit/);
  });

  it("preserves audit rows on user cleanup", () => {
    expect(sql).toMatch(/audit_logs: immutable/);
    expect(sql).not.toMatch(/_nullify_profile_ref\('audit_logs'/);
    expect(sql).not.toMatch(/_reassign_profile_ref\('clinical_record_audit'/);
  });

  it("drops immutability triggers before patient_id backfill", () => {
    const backfillPos = sql.indexOf("UPDATE clinical_record_audit cra");
    const dropPos = sql.indexOf("DROP TRIGGER IF EXISTS clinical_record_audit_immutable");
    expect(dropPos).toBeGreaterThan(-1);
    expect(backfillPos).toBeGreaterThan(dropPos);
  });
});

describe("audit-log helpers", () => {
  it("deriveAuditModule maps entity types", () => {
    expect(deriveAuditModule("clinical_record")).toBe("clinical");
    expect(deriveAuditModule("cash_charge")).toBe("cash");
    expect(deriveAuditModule("unknown_thing")).toBe("system");
  });

  it("buildAuditLogRow includes all immutable fields", () => {
    const row = buildAuditLogRow({
      userId: "user-1",
      clinicId: "clinic-1",
      module: "patients",
      what: "Actualizó ficha del paciente",
      entityType: "patient",
      entityId: "p-1",
      patientId: "p-1",
      action: "update",
      oldValues: { phone: "111" },
      newValues: { phone: "222" },
      ipAddress: "10.0.0.1",
      userAgent: "TestAgent/1.0",
    });

    expect(row.user_id).toBe("user-1");
    expect(row.clinic_id).toBe("clinic-1");
    expect(row.module).toBe("patients");
    expect(row.what).toBe("Actualizó ficha del paciente");
    expect(row.patient_id).toBe("p-1");
    expect(row.old_values).toEqual({ phone: "111" });
    expect(row.new_values).toEqual({ phone: "222" });
    expect(row.ip_address).toBe("10.0.0.1");
    expect(row.user_agent).toBe("TestAgent/1.0");
  });

  it("buildAuditWhat falls back to action + entity labels", () => {
    expect(buildAuditWhat("create", "patient")).toBe("Creación — Paciente");
  });

  it("auditFieldChanges captures diffs only", () => {
    const { oldValues, newValues } = auditFieldChanges(
      { a: 1, b: 2 },
      { a: 1, b: 3 },
      ["a", "b"]
    );
    expect(oldValues).toEqual({ b: 2 });
    expect(newValues).toEqual({ b: 3 });
  });

  it("auditModuleLabel translates modules", () => {
    expect(auditModuleLabel("clinical")).toBe("Clínico");
    expect(auditModuleLabel("cash")).toBe("Caja");
  });
});

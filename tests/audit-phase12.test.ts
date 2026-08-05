import { describe, expect, it } from "vitest";

import {
  auditActionLabel,
  auditEntityLabel,
  mergePatientAuditEvents,
  sanitizeAuditSnapshot,
} from "@/core/security/audit-types";

describe("audit helpers", () => {
  it("auditActionLabel translates actions", () => {
    expect(auditActionLabel("create")).toBe("Creación");
    expect(auditActionLabel("export")).toBe("Exportación");
  });

  it("auditEntityLabel translates entity types", () => {
    expect(auditEntityLabel("clinical_record")).toBe("Consulta clínica");
    expect(auditEntityLabel("patient")).toBe("Paciente");
  });

  it("sanitizeAuditSnapshot truncates long PHI fields", () => {
    const long = "x".repeat(300);
    const out = sanitizeAuditSnapshot({ evolution: long, diagnosis: "HTA" });
    expect(String(out?.evolution)).toContain("…");
    expect(out?.diagnosis).toBe("HTA");
  });

  it("mergePatientAuditEvents sorts by date desc", () => {
    const merged = mergePatientAuditEvents(
      [
        {
          id: "1",
          action: "update",
          entity_type: "patient",
          entity_id: "p1",
          created_at: "2026-01-01T10:00:00Z",
          ip_address: null,
          user_agent: null,
          old_values: null,
          new_values: null,
          profiles: { full_name: "Dr. A" },
        },
      ],
      [
        {
          id: "2",
          action: "create",
          clinical_record_id: "r1",
          changed_at: "2026-02-01T10:00:00Z",
          ip_address: "1.2.3.4",
          user_agent: "Mozilla",
          old_values: null,
          new_values: { diagnosis: "HTA" },
          profiles: { full_name: "Dr. B" },
        },
      ]
    );
    expect(merged[0].occurredAt).toBe("2026-02-01T10:00:00Z");
    expect(merged[0].actorName).toBe("Dr. B");
  });
});

describe("048_audit_phase12 migration", () => {
  it("defines immutable audit triggers and patient_id column", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/048_audit_phase12.sql"),
      "utf8"
    );
    expect(sql).toMatch(/patient_id UUID/);
    expect(sql).toMatch(/prevent_audit_mutation/);
    expect(sql).toMatch(/can_view_clinical\(clinic_id\)/);
  });

  it("auditoria tab is ready", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const src = readFileSync(
      resolve(process.cwd(), "src/features/pacientes/constants/patient-workspace-tabs.ts"),
      "utf8"
    );
    expect(src).toMatch(/id: "auditoria"[\s\S]*ready: true/);
  });
});

import { readFileSync } from "fs";
import {resolve } from "path";
import {describe, expect, it } from "vitest";

import {
  auditFieldChanges,
  buildAuditLogRow,
} from "@/core/security/audit-log";

const ROOT = process.cwd();

describe("centralized audit log row", () => {
  it("builds immutable row with user, module, IP and diffs", () => {
    const row = buildAuditLogRow({
      clinicId: "clinic-1",
      userId: "user-1",
      module: "settings",
      entityType: "clinic",
      entityId: "clinic-1",
      action: "update",
      what: "Actualizó configuración",
      oldValues: { name: "A" },
      newValues: { name: "B" },
      ipAddress: "203.0.113.1",
      userAgent: "TestAgent/1.0",
    });

    expect(row.user_id).toBe("user-1");
    expect(row.clinic_id).toBe("clinic-1");
    expect(row.module).toBe("settings");
    expect(row.action).toBe("update");
    expect(row.old_values).toEqual({ name: "A" });
    expect(row.new_values).toEqual({ name: "B" });
    expect(row.ip_address).toBe("203.0.113.1");
    expect(row.user_agent).toBe("TestAgent/1.0");
    expect(row.what).toContain("Actualizó");
  });

  it("auditFieldChanges captures only changed keys", () => {
    const { oldValues, newValues } = auditFieldChanges(
      { role: "doctor", active: true },
      { role: "secretary", active: true },
      ["role", "active"]
    );
    expect(oldValues).toEqual({ role: "doctor" });
    expect(newValues).toEqual({ role: "secretary" });
  });
});

describe("audit service module", () => {
  it("exports recordAudit from audit-service", () => {
    const src = readFileSync(resolve(ROOT, "src/core/security/audit-service.ts"), "utf8");
    expect(src).toContain("export async function recordAudit");
    expect(src).toContain("export async function recordAuditChange");
    expect(src).toContain("getAuditRequestContext");
    expect(src).toContain("buildAuditLogRow");
  });

  it("session logAudit delegates to recordAudit", () => {
    const src = readFileSync(resolve(ROOT, "src/core/auth/session.actions.ts"), "utf8");
    expect(src).toContain("recordAudit");
    expect(src).not.toContain("buildAuditLogRow");
  });
});

describe("critical operations audit coverage", () => {
  const criticalMutations: Array<{
    file: string;
    mustAudit: string[];
    auditPattern?: RegExp;
  }> = [
    {
      file: "src/lib/actions/invitations.ts",
      mustAudit: ["inviteClinicMember", "revokeClinicInvitation", "updateClinicMemberRole"],
    },
    {
      file: "src/lib/actions/account.ts",
      mustAudit: ["deleteMyAccount"],
    },
    {
      file: "src/features/recetas/actions/medical-orders.ts",
      mustAudit: ["createMedicalOrder", "voidMedicalOrder"],
      auditPattern: /recordAudit|logAudit|recordMedicalOrder\w+Audit/,
    },
    {
      file: "src/features/recetas/actions/prescriptions.ts",
      mustAudit: ["issuePrescription", "voidPrescription"],
    },
    {
      file: "src/lib/actions/coverages.ts",
      mustAudit: ["updateClinicCoverages"],
    },
    {
      file: "src/lib/actions/appointments.ts",
      mustAudit: ["startConsultationFromAppointment", "finalizeConsultation"],
    },
  ];

  for (const { file, mustAudit, auditPattern = /recordAudit|logAudit/ } of criticalMutations) {
    it(`${file} audits critical mutations`, () => {
      const content = readFileSync(resolve(ROOT, file), "utf8");
      expect(content).toMatch(auditPattern);
      for (const fn of mustAudit) {
        const fnBody = content.slice(content.indexOf(`export async function ${fn}`));
        const nextFn = fnBody.indexOf("\nexport async function ", 10);
        const section = nextFn > 0 ? fnBody.slice(0, nextFn) : fnBody;
        const auditsInSection = /recordAudit|logAudit|recordAuditChange|recordMedicalOrder\w+Audit/.test(
          section
        );
        const auditsViaHelper =
          fn === "inviteClinicMember" &&
          /async function linkInvitedUserToClinic[\s\S]*recordAudit/.test(content);
        expect(auditsInSection || auditsViaHelper).toBe(true);
      }
    });
  }
});

describe("audit immutable migration", () => {
  it("055 migration enforces audit_logs immutability", () => {
    const sql = readFileSync(
      resolve(ROOT, "supabase/migrations/055_immutable_audit_logging.sql"),
      "utf8"
    );
    expect(sql).toMatch(/audit_logs_immutable/);
    expect(sql).toMatch(/old_values/);
    expect(sql).toMatch(/new_values/);
  });
});

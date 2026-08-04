import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("053_security_p0_p1_fixes migration", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/053_security_p0_p1_fixes.sql"),
    "utf8"
  );

  it("tightens audit_logs INSERT to tenant + user", () => {
    expect(sql).toMatch(/audit_logs_insert/);
    expect(sql).toMatch(/user_id = auth\.uid\(\)/);
    expect(sql).toMatch(/clinic_id IN \(SELECT user_clinic_ids\(\)\)/);
  });

  it("gates clinical_record_attachments writes with can_write_clinical", () => {
    expect(sql).toMatch(/clinical_record_attachments_insert/);
    expect(sql).toMatch(/can_write_clinical\(clinic_id\)/);
  });

  it("adds path-aware storage policies", () => {
    expect(sql).toMatch(/can_read_clinical_storage/);
    expect(sql).toMatch(/can_write_clinical_storage/);
    expect(sql).toMatch(/can_manage_admin_docs/);
  });

  it("restricts clinic_jobs INSERT to staff roles", () => {
    expect(sql).toMatch(/clinic_jobs_insert/);
    expect(sql).toMatch(/clinic_admin', 'doctor', 'secretary/);
  });
});

describe("P1 app-layer security fixes", () => {
  it("sendReminder requires manageAppointments", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/lib/actions/clinic-services.ts"),
      "utf8"
    );
    expect(src).toMatch(/sendReminder[\s\S]*requireClinicPermission\("manageAppointments"\)/);
  });

  it("admin document upload validates patient clinic", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/lib/actions/admin-documents.ts"),
      "utf8"
    );
    expect(src).toMatch(/from\("patients"\)[\s\S]*eq\("clinic_id", clinicId\)/);
  });

  it("job handlers validate storage path prefix", () => {
    const pdf = readFileSync(
      resolve(process.cwd(), "src/lib/jobs/handlers/import-clinical-pdf.ts"),
      "utf8"
    );
    const batch = readFileSync(
      resolve(process.cwd(), "src/lib/jobs/handlers/import-batch.ts"),
      "utf8"
    );
    expect(pdf).toContain("assertStoragePathInClinic");
    expect(batch).toContain("assertStoragePathInClinic");
  });
});

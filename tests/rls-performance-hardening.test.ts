import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

describe("090 RLS performance hardening migration", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/090_rls_performance_hardening.sql"),
    "utf8"
  );

  it("defines is_clinic_staff before using it in policies", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION is_clinic_staff/);
    const fnIdx = sql.indexOf("CREATE OR REPLACE FUNCTION is_clinic_staff");
    const policyIdx = sql.indexOf("appointment_status_history_insert");
    expect(fnIdx).toBeGreaterThan(-1);
    expect(policyIdx).toBeGreaterThan(fnIdx);
  });

  it("adds indexes for clinic_members and patient portal RLS paths", () => {
    expect(sql).toMatch(/idx_clinic_members_user_active_clinic/);
    expect(sql).toMatch(/ON clinic_members \(user_id, clinic_id\)/);
    expect(sql).toMatch(/WHERE is_active = true/);
    expect(sql).toMatch(/idx_patients_user_id/);
    expect(sql).toMatch(/ON patients \(user_id\)/);
  });

  it("replaces inline clinic_members subqueries with user_clinic_ids()", () => {
    expect(sql).toMatch(/appointment_status_history_select[\s\S]*user_clinic_ids\(\)/);
    expect(sql).toMatch(/waiting_list_select[\s\S]*user_clinic_ids\(\)/);
    expect(sql).not.toMatch(
      /FROM clinic_members WHERE user_id = auth\.uid\(\) AND is_active = true/
    );
  });

  it("consolidates staff write checks to is_clinic_staff without dropping superadmin bypass", () => {
    expect(sql).toMatch(/appointment_status_history_insert[\s\S]*is_clinic_staff\(clinic_id\)/);
    expect(sql).toMatch(/waiting_list_write[\s\S]*is_clinic_staff\(clinic_id\)/);
    expect(sql).toMatch(/is_superadmin\(\) OR is_clinic_staff/);
  });

  it("keeps notification queue admin scoping on SELECT while optimizing INSERT", () => {
    expect(sql).toMatch(/appointment_notification_queue_insert[\s\S]*is_clinic_staff\(clinic_id\)/);
    expect(sql).not.toMatch(/appointment_notification_queue_select/);
    expect(sql).not.toMatch(/appointment_notification_queue_update/);
  });

  it("simplifies clinic_jobs_select to is_clinic_staff", () => {
    expect(sql).toMatch(/clinic_jobs_select[\s\S]*is_clinic_staff\(clinic_id\)/);
    expect(sql).not.toMatch(/clinic_jobs_select[\s\S]*user_clinic_ids\(\)[\s\S]*user_role_in_clinic/);
  });
});

describe("RLS security equivalence (090 staff policies)", () => {
  it("is_clinic_staff covers the same roles as can_manage_clinic OR is_doctor_in_clinic", () => {
    const roles058 = readFileSync(
      resolve(process.cwd(), "supabase/migrations/058_rls_audit_hardening.sql"),
      "utf8"
    );
    expect(roles058).toMatch(/is_clinic_staff[\s\S]*clinic_admin', 'doctor', 'secretary/);

    const roles002 = readFileSync(
      resolve(process.cwd(), "supabase/migrations/002_rls_policies.sql"),
      "utf8"
    );
    expect(roles002).toMatch(/can_manage_clinic[\s\S]*clinic_admin', 'secretary/);
    expect(roles002).toMatch(/is_doctor_in_clinic[\s\S]*= 'doctor'/);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sql093 = readFileSync(
  join(process.cwd(), "supabase/migrations/093_fix_delete_account_audit_fks.sql"),
  "utf8"
);

const sql094 = readFileSync(
  join(process.cwd(), "supabase/migrations/094_fix_user_deletion_appointment_fks.sql"),
  "utf8"
);

describe("093_fix_delete_account_audit_fks migration", () => {
  it("maintains audit refs during account deletion", () => {
    expect(sql093).toMatch(/_maintain_audit_refs_for_user_deletion/);
    expect(sql093).toMatch(/DISABLE TRIGGER clinical_record_audit_immutable/);
    expect(sql093).toMatch(/_maintain_audit_refs_for_user_deletion\(p_user_id, v_fallback\)/);
  });
});

describe("094_fix_user_deletion_appointment_fks migration", () => {
  it("nullifies appointment module profile refs before user delete", () => {
    expect(sql094).toMatch(/appointment_status_history.*changed_by/);
    expect(sql094).toMatch(/waiting_list.*created_by/);
  });

  it("runs cleanup before remove_clinic_member_user deletes auth row", () => {
    expect(sql094).toMatch(/PERFORM cleanup_user_profile_references\(p_user_id, auth\.uid\(\)\)/);
  });
});

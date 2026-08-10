import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/093_fix_delete_account_audit_fks.sql"),
  "utf8"
);

describe("093_fix_delete_account_audit_fks migration", () => {
  it("maintains audit refs during account deletion", () => {
    expect(sql).toMatch(/_maintain_audit_refs_for_user_deletion/);
    expect(sql).toMatch(/DISABLE TRIGGER clinical_record_audit_immutable/);
    expect(sql).toMatch(/_maintain_audit_refs_for_user_deletion\(p_user_id, v_fallback\)/);
  });
});

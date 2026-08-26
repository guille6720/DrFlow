import { readdirSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { describe, expect, it } from "vitest";

const migrationsDir = resolve(process.cwd(), "supabase/migrations");

function loadAllSql(): string {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
    .join("\n");
}

describe("057_schema_code_parity migration", () => {
  const sql = readFileSync(
    resolve(migrationsDir, "057_schema_code_parity.sql"),
    "utf8"
  );

  it("adds clinic_members.professional_id", () => {
    expect(sql).toMatch(/ALTER TABLE clinic_members[\s\S]*professional_id UUID/i);
    expect(sql).toMatch(/idx_clinic_members_professional/);
  });

  it("backfills professional_id from professionals", () => {
    expect(sql).toMatch(/UPDATE clinic_members cm[\s\S]*FROM professionals p/i);
  });

  it("syncs patients.notes to patient_clinical_profiles without DROP", () => {
    expect(sql).toMatch(/INSERT INTO patient_clinical_profiles[\s\S]*FROM patients p/i);
    expect(sql).not.toMatch(/DROP COLUMN/);
  });

  it("updates setup_user_clinic with professional_id and feature flags", () => {
    expect(sql).toMatch(/UPDATE clinic_members[\s\S]*professional_id = v_pro_id/i);
    expect(sql).toMatch(/admin_ops_assistant/);
    expect(sql).toMatch(/INSERT INTO clinic_feature_flags/);
  });
});

describe("schema expectations vs migrations", () => {
  const sql = loadAllSql();

  it("includes clinic_members.professional_id column", () => {
    expect(sql).toMatch(/clinic_members[\s\S]*professional_id/i);
  });

  it("defines all code-referenced RPCs", () => {
    const rpcs = [
      "setup_user_clinic",
      "submit_public_booking",
      "get_public_booking_occupancy",
      "delete_own_account",
      "search_pami_vademecum",
      "search_medication_catalog",
      "claim_clinic_jobs",
      "get_clinic_entitlements",
      "increment_feature_usage",
      "try_consume_feature_usage",
      "assign_clinic_entitlement_plan",
      "upsert_clinic_feature_override",
      "get_clinic_entitlement_usage",
      "set_clinic_entitlement_status",
      "clinic_current_entitlement_subscription_id",
      "clear_clinic_feature_override",
      "entitlement_metered_commercially_blocked",
      "entitlement_subscription_is_live",
      "set_clinic_entitlement_trial_end",
      "expire_lapsed_clinic_entitlement_trials",
    ];
    for (const rpc of rpcs) {
      expect(sql, `RPC ${rpc}`).toMatch(new RegExp(`FUNCTION\\s+(?:public\\.)?${rpc}\\b`, "i"));
    }
  });

  it("has hot-path indexes from 054", () => {
    expect(sql).toMatch(/idx_patients_clinic_active_lastname/);
    expect(sql).toMatch(/idx_clinical_records_clinic_created/);
    expect(sql).toMatch(/idx_audit_logs_module_created/);
  });

  it("enables RLS on enterprise tables phase 13-16", () => {
    for (const table of [
      "clinic_plugins",
      "clinic_feature_flags",
      "clinic_jobs",
      "clinic_observability_events",
    ]) {
      expect(sql).toMatch(
        new RegExp(`ALTER\\s+TABLE\\s+${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, "i")
      );
    }
  });

  it("migration sequence has no unexpected numeric gaps (139 reserved before ReNaPDiS 140)", () => {
    const files = readdirSync(migrationsDir).filter((f) => /^\d{3}_/.test(f));
    const nums = files.map((f) => parseInt(f.slice(0, 3), 10)).sort((a, b) => a - b);
    expect(nums[nums.length - 1]).toBeGreaterThanOrEqual(57);
    for (let i = 1; i < nums.length; i++) {
      const prev = nums[i - 1];
      const curr = nums[i];
      if (curr - prev <= 1) continue;
      // 139 intentionally reserved; ReNaPDiS Phase 1 starts at 140.
      if (prev === 138 && curr === 140) continue;
      const gap = prev + 1;
      expect.fail(`Missing migration number ${String(gap).padStart(3, "0")}`);
    }
  });
});

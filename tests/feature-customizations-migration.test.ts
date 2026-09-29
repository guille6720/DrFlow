import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import { FEATURE_CUSTOMIZATION_REGISTRY, FEATURE_KEYS } from "@/core/customizations/registry";

const MIGRATION = "20260928120000_feature_customizations";
const sql = readFileSync(resolve(process.cwd(), `supabase/migrations/${MIGRATION}.sql`), "utf8");
const down = readFileSync(
  resolve(process.cwd(), `supabase/migrations/rollback/${MIGRATION}.down.sql`),
  "utf8"
);
/** Features added by later migrations seed `feature_definitions` there. */
const laterFeatureSeeds = [
  "20260929120000_national_eprescription_repository",
  "20260929130000_rcta_integration_feature",
]
  .map((m) => readFileSync(resolve(process.cwd(), `supabase/migrations/${m}.sql`), "utf8"))
  .join("\n");

function fnBody(name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(start, `function ${name} missing`).toBeGreaterThan(-1);
  const end = sql.indexOf("$$;", start);
  return sql.slice(start, end);
}

describe("feature customizations migration — schema", () => {
  it("creates the three tables with the required unique keys", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.feature_definitions/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.clinic_feature_settings/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.user_feature_settings/);
    expect(sql).toMatch(/clinic_feature_settings_unique UNIQUE \(clinic_id, feature_key\)/);
    expect(sql).toMatch(/user_feature_settings_unique UNIQUE \(clinic_id, user_id, feature_key\)/);
    for (const col of ["created_at", "updated_at", "created_by", "updated_by", "enabled", "config JSONB"]) {
      expect(sql).toContain(col);
    }
  });

  it("user settings require membership of the same clinic (composite FK to clinic_members)", () => {
    expect(sql).toMatch(
      /FOREIGN KEY \(clinic_id, user_id\)\s+REFERENCES public\.clinic_members \(clinic_id, user_id\) ON DELETE CASCADE/
    );
  });

  it("config must be a JSON object with a size limit (no executable payloads)", () => {
    expect(sql).toMatch(/jsonb_typeof\(config\) = 'object' AND octet_length\(config::text\) <= 8192/);
  });

  it("seeds feature_definitions matching the code registry defaults, and no clinic/user rows", () => {
    const seeds = `${sql}\n${laterFeatureSeeds}`;
    for (const key of FEATURE_KEYS) {
      const def = FEATURE_CUSTOMIZATION_REGISTRY[key];
      const row = new RegExp(`\\('${key}',[^\\n]*?, ${def.defaultEnabled}, ${def.configurableByClinic}, ${def.configurableByUser}, ${def.critical}\\)`);
      expect(seeds, `seed row for ${key}`).toMatch(row);
    }
    expect(sql).not.toMatch(/INSERT INTO public\.clinic_feature_settings[^;]*SELECT/);
    expect(sql).not.toMatch(/INSERT INTO public\.user_feature_settings[^;]*SELECT/);
  });

  it("is additive: no DROP/ALTER of existing objects", () => {
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/ALTER TABLE public\.(clinics|clinic_members|profiles|audit_logs)\b/i);
    expect(sql).not.toMatch(/DELETE FROM public\.(clinics|clinic_members|profiles|audit_logs)\b/i);
  });

  it("has a rollback that drops only the new objects", () => {
    expect(down).toMatch(/DROP TABLE IF EXISTS public\.user_feature_settings/);
    expect(down).toMatch(/DROP TABLE IF EXISTS public\.clinic_feature_settings/);
    expect(down).toMatch(/DROP TABLE IF EXISTS public\.feature_definitions/);
    expect(down).not.toMatch(/(DROP|DELETE|TRUNCATE|ALTER)[^;\n]*\b(audit_logs|clinic_members|clinics|profiles)\b/i);
  });
});

describe("Test C — cross-tenant access denied (SQL)", () => {
  it("snapshot RPC rejects clinics the caller does not belong to", () => {
    const body = fnBody("get_feature_settings_snapshot");
    expect(body).toMatch(/SECURITY DEFINER/);
    expect(body).toMatch(/NOT \(p_clinic_id IN \(SELECT public\.user_clinic_ids\(\)\)\)/);
    expect(body).toMatch(/RAISE EXCEPTION 'FORBIDDEN'/);
  });

  it("snapshot only returns the caller's own user rows for that clinic", () => {
    const body = fnBody("get_feature_settings_snapshot");
    expect(body).toMatch(/v_uid UUID := auth\.uid\(\)/);
    expect(body).toMatch(/u\.user_id = v_uid/);
    expect(body).toMatch(/WHERE u\.clinic_id = p_clinic_id/);
    expect(body).toMatch(/WHERE s\.clinic_id = p_clinic_id/);
    expect(body).not.toMatch(/p_user_id/);
  });

  it("RLS SELECT policies scope rows by clinic membership / role", () => {
    expect(sql).toMatch(/ALTER TABLE public\.clinic_feature_settings ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/ALTER TABLE public\.user_feature_settings ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(
      /clinic_feature_settings_select[\s\S]*?public\.is_superadmin\(\)\s+OR public\.user_role_in_clinic\(clinic_id\) = 'clinic_admin'/
    );
    expect(sql).toMatch(
      /user_feature_settings_select[\s\S]*?user_id = auth\.uid\(\) AND clinic_id IN \(SELECT public\.user_clinic_ids\(\)\)/
    );
  });

  it("user setter rejects users outside the clinic", () => {
    const body = fnBody("set_user_feature_setting");
    expect(body).toMatch(/clinic_id = p_clinic_id AND user_id = p_user_id AND is_active = true/);
    expect(body).toMatch(/USER_NOT_IN_CLINIC/);
  });
});

describe("Test D — clinic admin cannot modify (SQL)", () => {
  it("no INSERT/UPDATE/DELETE policies exist for app roles", () => {
    expect(sql).not.toMatch(/CREATE POLICY \w+ ON public\.(clinic|user)_feature_settings\s+FOR (INSERT|UPDATE|DELETE|ALL)/);
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE|ALL)[^;]*TO authenticated/);
  });

  it("every mutating RPC asserts Superadmin first", () => {
    for (const name of [
      "set_clinic_feature_setting",
      "clear_clinic_feature_setting",
      "set_user_feature_setting",
      "clear_user_feature_setting",
    ]) {
      const body = fnBody(name);
      expect(body, name).toMatch(/BEGIN\s+PERFORM public\.assert_entitlement_superadmin\(\);/);
      expect(body, name).toMatch(/SECURITY DEFINER/);
      expect(body, name).toMatch(/SET search_path = public/);
    }
  });

  it("RPCs and tables are never available to anon/PUBLIC", () => {
    for (const table of ["feature_definitions", "clinic_feature_settings", "user_feature_settings"]) {
      expect(sql).toMatch(new RegExp(`REVOKE ALL ON public\\.${table} FROM PUBLIC, anon, authenticated;`));
      expect(sql).toMatch(new RegExp(`GRANT SELECT ON public\\.${table} TO authenticated;`));
    }
    for (const fn of [
      "get_feature_settings_snapshot",
      "set_clinic_feature_setting",
      "clear_clinic_feature_setting",
      "set_user_feature_setting",
      "clear_user_feature_setting",
    ]) {
      expect(sql).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\([^)]*\\) FROM PUBLIC, anon`));
    }
  });
});

describe("audit trail", () => {
  it("every mutation writes audit_logs with feature, target user, old/new, actor and environment", () => {
    for (const name of [
      "set_clinic_feature_setting",
      "clear_clinic_feature_setting",
      "set_user_feature_setting",
      "clear_user_feature_setting",
    ]) {
      const body = fnBody(name);
      expect(body, name).toMatch(/INSERT INTO public\.audit_logs/);
      expect(body, name).toMatch(/'feature_key', p_feature_key/);
      expect(body, name).toMatch(/'target_user_id'/);
      expect(body, name).toMatch(/'environment', public\.normalize_feature_environment\(p_environment\)/);
      expect(body, name).toMatch(/v_actor/);
    }
  });
});

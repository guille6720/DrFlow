import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8").replace(/\r\n/g, "\n");

const v2 = read("supabase/migrations/20260929100000_medical_orders_v2.sql");
const fix = read("supabase/migrations/20261014120000_medical_orders_v2_guard_clinical_purge_detach.sql");
const fixDown = read("supabase/migrations/rollback/20261014120000_medical_orders_v2_guard_clinical_purge_detach.down.sql");
const freeze = read("supabase/scripts/recovery-medical-orders-v2-freeze.sql");
const unfreeze = read("supabase/scripts/recovery-medical-orders-v2-unfreeze.sql");
const fullRollback = read("supabase/scripts/recovery-medical-orders-v2-full-rollback.sql");
const grantsDown = read("supabase/migrations/rollback/20260928155026_hardening_clinic_products_grants.down.sql");

function guardDefinition(sql: string): string {
  const start = sql.indexOf("CREATE OR REPLACE FUNCTION public.medical_orders_v2_guard()");
  const end = sql.indexOf("REVOKE ALL ON FUNCTION public.medical_orders_v2_guard()", start);
  expect(start, "guard definition missing").toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

function purgeDetachBlock(guard: string): string {
  const start = guard.indexOf("  -- Issued / void: the clinical purge deletes the linked record");
  const end = guard.indexOf("  -- Issued / void: dates may be re-synced");
  expect(start).toBeGreaterThan(-1);
  return guard.slice(start, end);
}

describe("medical orders v2 — D4 clinical purge forward fix", () => {
  const guard = guardDefinition(fix);
  const block = purgeDetachBlock(guard);

  it("only adds the purge-detach exception to the original guard", () => {
    expect(guard.replace(block, "")).toBe(guardDefinition(v2));
  });

  it("requires the purge flag, a deleted record and an otherwise unchanged row", () => {
    expect(block).toContain("current_setting('app.allow_clinical_hard_delete', true), 'false') = 'true'");
    expect(block).toContain("OLD.clinical_record_id IS NOT NULL");
    expect(block).toContain("NEW.clinical_record_id IS NULL");
    expect(block).toMatch(/NOT EXISTS \(SELECT 1 FROM public\.clinical_records cr WHERE cr\.id = OLD\.clinical_record_id\)/);
    expect(block).toContain("(v_ignore || ARRAY['clinical_record_id'])");
  });

  it("audits every detach with tenant, patient and document identity", () => {
    expect(block).toMatch(/INSERT INTO public\.audit_logs/);
    expect(block).toContain("'MEDICAL_ORDER_CLINICAL_RECORD_DETACHED'");
    expect(block).toContain("OLD.clinic_id");
    expect(block).toContain("OLD.patient_id");
    expect(block).toContain("'document_hash', OLD.document_hash");
  });

  it("is a function replacement only and checks its prerequisite", () => {
    expect(fix).not.toMatch(/DROP |ALTER TABLE|CREATE TRIGGER|GRANT /i);
    expect(fix).toContain("MIGRATION_PREREQUISITE_MISSING");
    expect(fix).toMatch(/REVOKE ALL ON FUNCTION public\.medical_orders_v2_guard\(\) FROM PUBLIC, anon, authenticated/);
  });

  it("rollback restores the original guard verbatim", () => {
    expect(guardDefinition(fixDown)).toBe(guardDefinition(v2));
  });
});

describe("medical orders v2 — recovery scripts", () => {
  it("containment fires before the v2 guard and never drops data", () => {
    expect(freeze).toMatch(/CREATE TRIGGER trg_medical_orders_00_v2_recovery_freeze/);
    expect("trg_medical_orders_00_v2_recovery_freeze" < "trg_medical_orders_v2_guard").toBe(true);
    expect(freeze).toContain("MEDICAL_ORDERS_V2_FROZEN");
    expect(freeze).not.toMatch(/DROP (TABLE|COLUMN)|DELETE FROM|TRUNCATE/i);
    expect(unfreeze).toMatch(/DROP TRIGGER IF EXISTS trg_medical_orders_00_v2_recovery_freeze/);
  });

  it("full rollback drops can_view_medical_orders only after the tables whose policies use it", () => {
    const dropItems = fullRollback.indexOf("DROP TABLE IF EXISTS public.medical_order_items;");
    const dropHelper = fullRollback.indexOf("DROP FUNCTION IF EXISTS public.can_view_medical_orders(UUID);");
    expect(dropItems).toBeGreaterThan(-1);
    expect(dropHelper).toBeGreaterThan(dropItems);
    expect(fullRollback).toContain("DROP FUNCTION IF EXISTS public.medical_order_items_guard();");
  });

  it("full rollback refuses to destroy issued documents without explicit confirmation", () => {
    expect(fullRollback).toContain("MEDICAL_ORDERS_V2_DOCUMENTS_EXIST");
    expect(fullRollback).toContain("nexclinic.confirm_v2_data_loss");
    expect(fullRollback.indexOf("CREATE TABLE rollback_export.medical_orders_v2")).toBeLessThan(
      fullRollback.indexOf("DROP TABLE IF EXISTS public.medical_order_items;")
    );
    expect(fullRollback).toMatch(/REVOKE ALL ON ALL TABLES IN SCHEMA rollback_export FROM PUBLIC, anon, authenticated/);
  });

  it("full rollback removes the v2 columns so the app falls back to legacy orders", () => {
    for (const column of ["order_category", "order_number", "document_hash", "public_verification_token"]) {
      expect(fullRollback).toContain(`DROP COLUMN IF EXISTS ${column}`);
    }
    expect(fullRollback).toContain("MEDICAL_ORDERS_V2_ROLLBACK_INCOMPLETE");
    expect(fullRollback.trim().startsWith("--")).toBe(true);
    expect(fullRollback).toMatch(/^BEGIN;$/m);
    expect(fullRollback).toMatch(/^COMMIT;$/m);
  });
});

describe("clinic_products grant hardening rollback", () => {
  it("restores an enumerated privilege list, never a blind GRANT ALL", () => {
    expect(grantsDown).not.toMatch(/GRANT ALL/i);
    expect(grantsDown).toMatch(
      /GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER\s+ON TABLE public\.clinic_products TO anon, authenticated;/
    );
  });

  it("checks the post-migration state before acting and verifies the exact ACL afterwards", () => {
    expect(grantsDown).toContain("CLINIC_PRODUCTS_ROLLBACK_UNEXPECTED_STATE");
    expect(grantsDown).toContain("CLINIC_PRODUCTS_ROLLBACK_VERIFY_FAILED");
    expect(grantsDown).toContain("'arwdDxtm'");
    expect(grantsDown).toContain("'arwdDxt'");
  });
});

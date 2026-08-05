import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("063_atomic_operations migration", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/063_atomic_operations.sql"),
    "utf8"
  );

  it("extends submit_public_booking with consent in same transaction", () => {
    expect(sql).toMatch(/p_consent_type TEXT DEFAULT NULL/);
    expect(sql).toMatch(/INSERT INTO consent_records/);
    expect(sql.indexOf("INSERT INTO consent_records")).toBeGreaterThan(
      sql.indexOf("INSERT INTO appointments")
    );
  });

  it("defines atomic RPCs for high-risk multi-table flows", () => {
    expect(sql).toMatch(/create_cash_charge_atomic/);
    expect(sql).toMatch(/void_cash_charge_atomic/);
    expect(sql).toMatch(/create_clinical_record_atomic/);
    expect(sql).toMatch(/update_clinical_record_atomic/);
    expect(sql).toMatch(/create_patient_with_clinical_profile/);
    expect(sql).toMatch(/update_waiting_room_status_atomic/);
    expect(sql).toMatch(/create_telemedicine_session_atomic/);
    expect(sql).toMatch(/accept_clinic_invitation_for_existing_user/);
  });

  it("adds waiting_room prerequisites before RPC that uses the enum", () => {
    expect(sql).toMatch(/CREATE TYPE waiting_room_status AS ENUM/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS waiting_room_status/);
    expect(sql.indexOf("waiting_room_status AS ENUM")).toBeLessThan(
      sql.indexOf("update_waiting_room_status_atomic")
    );
  });

  it("guards caja RPCs when module missing", () => {
    expect(sql).toMatch(/to_regclass\('public\.cash_charges'\)/);
    expect(sql).toMatch(/EXECUTE \$sql\$[\s\S]*create_cash_charge_atomic/);
  });

  it("uses row locks for ledger balance reads", () => {
    expect(sql).toMatch(/FOR UPDATE/);
  });
});

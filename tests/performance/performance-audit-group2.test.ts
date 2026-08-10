import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CUENTA_CORRIENTE_LEDGER_PAGE_SIZE,
  PATIENT_EHR_RECORD_PAGE_SIZE,
} from "@/core/supabase/pagination";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/092_performance_audit_group2.sql"),
  "utf8"
);

describe("092 performance audit group2 migration", () => {
  it("adds summarize_appointments_for_turnos_reportes RPC guarded by appointments table", () => {
    expect(sql).toMatch(/to_regclass\('public\.appointments'\)/);
    expect(sql).toMatch(/summarize_appointments_for_turnos_reportes/);
    expect(sql).toMatch(/last7_booked_minutes/);
    expect(sql).toMatch(/by_professional_today/);
  });
});

describe("Grupo 2 pagination constants", () => {
  it("caps initial EHR clinical records at 80", () => {
    expect(PATIENT_EHR_RECORD_PAGE_SIZE).toBe(80);
  });

  it("paginates cuenta corriente ledger at 50 rows", () => {
    expect(CUENTA_CORRIENTE_LEDGER_PAGE_SIZE).toBe(50);
  });
});

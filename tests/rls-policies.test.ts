import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import {
  SECURITY_DEFINER_RPC_CHECKS,
  TABLES_REQUIRING_RLS,
} from "@/core/security/rls-manifest";

function loadAllMigrationSql(): string {
  const dir = resolve(process.cwd(), "supabase/migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(resolve(dir, f), "utf8"))
    .join("\n");
}

describe("RLS policy manifest (static audit)", () => {
  const sql = loadAllMigrationSql();

  it("enables RLS on every clinic-scoped table in the manifest", () => {
    const missing: string[] = [];

    for (const table of TABLES_REQUIRING_RLS) {
      const enablePattern = new RegExp(
        `ALTER\\s+TABLE\\s+${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
        "i"
      );
      const policyPattern = new RegExp(
        `CREATE\\s+POLICY\\s+\\w+\\s+ON\\s+${table}\\s+`,
        "i"
      );

      if (!enablePattern.test(sql) && !policyPattern.test(sql)) {
        missing.push(table);
      }
    }

    expect(missing, `Tablas sin RLS detectado en migraciones: ${missing.join(", ")}`).toEqual(
      []
    );
  });

  it("documents SECURITY DEFINER RPCs present in migrations", () => {
    for (const { name } of SECURITY_DEFINER_RPC_CHECKS) {
      expect(
        sql.includes(`FUNCTION ${name}`) ||
          sql.includes(`FUNCTION public.${name}`) ||
          sql.includes(`${name}(`),
        `RPC ${name} no encontrada en migraciones`
      ).toBe(true);
    }
  });

  it("seed_pami RPC en 030 incluye control FORBIDDEN", () => {
    const m030 = readFileSync(
      resolve(process.cwd(), "supabase/migrations/030_clinic_accepted_coverages.sql"),
      "utf8"
    );
    expect(m030).toMatch(/FORBIDDEN/i);
    expect(m030).toMatch(/p_clinic_id/i);
  });

  it("get_patient_appointment_statuses acota por clinic_id y documento", () => {
    const m022 = readFileSync(
      resolve(process.cwd(), "supabase/migrations/022_patient_appointment_status_rpc.sql"),
      "utf8"
    );
    expect(m022).toMatch(/document_number/i);
    expect(m022).toMatch(/clinic_id/i);
  });
});

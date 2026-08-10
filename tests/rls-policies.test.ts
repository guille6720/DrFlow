import { readdirSync, readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

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
        `ALTER\\s+TABLE\\s+(?:public\\.)?${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
        "i"
      );
      const policyPattern = new RegExp(
        `CREATE\\s+POLICY\\s+\\w+\\s+ON\\s+(?:public\\.)?${table}\\s+`,
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

  it("seed_pami RPC incluye idempotencia (030/077)", () => {
    const m077 = readFileSync(
      resolve(process.cwd(), "supabase/migrations/077_pami_cabecera_idempotent.sql"),
      "utf8"
    );
    expect(m077).toMatch(/FORBIDDEN/i);
    expect(m077).toMatch(/already_configured/i);
    expect(m077).toMatch(/pg_advisory_xact_lock/i);
    expect(m077).toMatch(/idx_clinical_templates_clinic_name/i);
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

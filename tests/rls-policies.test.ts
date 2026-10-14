import { readdirSync, readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  RLS_DENY_ALL_TABLES,
  SECURITY_DEFINER_RPC_CHECKS,
  TABLES_REQUIRING_RLS,
} from "@/core/security/rls-manifest";
import { auditRlsCoverage } from "@/core/security/rls-static-audit";

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

  const audit = auditRlsCoverage(sql, TABLES_REQUIRING_RLS);

  it("enables RLS on every clinic-scoped table in the manifest", () => {
    expect(audit.missingRls, `Tablas sin RLS en migraciones: ${audit.missingRls.join(", ")}`).toEqual(
      []
    );
  });

  it("never disables RLS on a manifest table", () => {
    expect(audit.disabledRls).toEqual([]);
  });

  it("defines policies for every manifest table except documented deny-all tables", () => {
    const missing = audit.missingPolicies.filter(
      (t) => !(RLS_DENY_ALL_TABLES as readonly string[]).includes(t)
    );
    expect(missing, `Tablas sin políticas RLS: ${missing.join(", ")}`).toEqual([]);
  });

  it("keeps deny-all tables free of policies", () => {
    const withPolicies = RLS_DENY_ALL_TABLES.filter((t) => !audit.missingPolicies.includes(t));
    expect(withPolicies).toEqual([]);
  });

  it("covers the geriatrics tables configured inside the 159 FOREACH loop", () => {
    const m159 = readFileSync(
      resolve(process.cwd(), "supabase/migrations/159_geriatrics_module.sql"),
      "utf8"
    );
    const geriatrics = TABLES_REQUIRING_RLS.filter((t) => t.startsWith("geriatrics_"));
    expect(geriatrics.length).toBe(19);
    expect(auditRlsCoverage(m159, geriatrics)).toEqual({
      missingRls: [],
      missingPolicies: [],
      disabledRls: [],
    });
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

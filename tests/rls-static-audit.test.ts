import { describe, expect, it } from "vitest";

import { auditRlsCoverage, collectRlsCoverage } from "@/core/security/rls-static-audit";

const loopSql = (tables: string[], body: string) => `
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    ${tables.map((name) => `'${name}'`).join(",\n    ")}
  ]
  LOOP
${body}
  END LOOP;
END;
$$;
`;

const ENABLE = "    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);";
const POLICY = `    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
       USING (clinic_id IN (SELECT public.user_clinic_ids()) AND role IN (''doctor'', ''secretary''))',
      t || '_select', t
    );`;

describe("auditRlsCoverage (literal statements)", () => {
  it("accepts a table with RLS enabled and a policy", () => {
    const sql = `
      CREATE TABLE public.foo (id uuid);
      ALTER TABLE public.foo ENABLE ROW LEVEL SECURITY;
      CREATE POLICY foo_select ON public.foo FOR SELECT USING (true);
    `;
    expect(auditRlsCoverage(sql, ["foo"])).toEqual({
      missingRls: [],
      missingPolicies: [],
      disabledRls: [],
    });
  });

  it("detects a table without RLS even when it has a policy", () => {
    const sql = `
      CREATE TABLE public.foo (id uuid);
      CREATE POLICY foo_select ON public.foo FOR SELECT USING (true);
    `;
    expect(auditRlsCoverage(sql, ["foo"]).missingRls).toEqual(["foo"]);
  });

  it("detects a table with RLS but without policies", () => {
    const sql = "ALTER TABLE foo ENABLE ROW LEVEL SECURITY;";
    const result = auditRlsCoverage(sql, ["foo"]);
    expect(result.missingRls).toEqual([]);
    expect(result.missingPolicies).toEqual(["foo"]);
  });

  it("does not let a policy on a similarly named table count", () => {
    const sql = `
      ALTER TABLE public.foo ENABLE ROW LEVEL SECURITY;
      CREATE POLICY foo_bar_select ON public.foo_bar FOR SELECT USING (true);
    `;
    expect(auditRlsCoverage(sql, ["foo"]).missingPolicies).toEqual(["foo"]);
  });

  it("ignores statements inside SQL comments", () => {
    const sql = `
      -- ALTER TABLE public.foo ENABLE ROW LEVEL SECURITY;
      /* CREATE POLICY foo_select ON public.foo FOR SELECT USING (true); */
    `;
    expect(auditRlsCoverage(sql, ["foo"])).toMatchObject({
      missingRls: ["foo"],
      missingPolicies: ["foo"],
    });
  });

  it("flags tables where RLS is disabled", () => {
    const sql = "ALTER TABLE public.foo DISABLE ROW LEVEL SECURITY;";
    expect(auditRlsCoverage(sql, ["foo"]).disabledRls).toEqual(["foo"]);
  });
});

describe("auditRlsCoverage (FOREACH loops)", () => {
  it("accepts tables enabled and policed inside a FOREACH loop", () => {
    const sql = loopSql(["geriatrics_rooms", "geriatrics_beds"], `${ENABLE}\n${POLICY}`);
    expect(auditRlsCoverage(sql, ["geriatrics_rooms", "geriatrics_beds"])).toEqual({
      missingRls: [],
      missingPolicies: [],
      disabledRls: [],
    });
  });

  it("detects incomplete loop coverage (manifest table missing from the array)", () => {
    const sql = loopSql(["geriatrics_rooms"], `${ENABLE}\n${POLICY}`);
    const result = auditRlsCoverage(sql, ["geriatrics_rooms", "geriatrics_beds"]);
    expect(result.missingRls).toEqual(["geriatrics_beds"]);
    expect(result.missingPolicies).toEqual(["geriatrics_beds"]);
  });

  it("detects a loop that enables RLS but creates no policies", () => {
    const sql = loopSql(["geriatrics_rooms"], ENABLE);
    const result = auditRlsCoverage(sql, ["geriatrics_rooms"]);
    expect(result.missingRls).toEqual([]);
    expect(result.missingPolicies).toEqual(["geriatrics_rooms"]);
  });

  it("detects a loop that creates policies but never enables RLS", () => {
    const sql = loopSql(["geriatrics_rooms"], POLICY);
    const result = auditRlsCoverage(sql, ["geriatrics_rooms"]);
    expect(result.missingRls).toEqual(["geriatrics_rooms"]);
    expect(result.missingPolicies).toEqual([]);
  });

  it("does not count dynamic statements that target a different variable", () => {
    const sql = loopSql(
      ["geriatrics_rooms"],
      "    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', other_table);"
    );
    expect(auditRlsCoverage(sql, ["geriatrics_rooms"]).missingRls).toEqual(["geriatrics_rooms"]);
  });

  it("does not treat a DROP POLICY-only loop as policy coverage", () => {
    const sql = loopSql(
      ["geriatrics_rooms"],
      `${ENABLE}\n    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);`
    );
    expect(auditRlsCoverage(sql, ["geriatrics_rooms"]).missingPolicies).toEqual([
      "geriatrics_rooms",
    ]);
  });

  it("collects literal and loop coverage together", () => {
    const sql = `${loopSql(["a_table"], `${ENABLE}\n${POLICY}`)}
      ALTER TABLE public.b_table ENABLE ROW LEVEL SECURITY;`;
    const coverage = collectRlsCoverage(sql);
    expect([...coverage.rlsEnabled].sort()).toEqual(["a_table", "b_table"]);
    expect([...coverage.withPolicies]).toEqual(["a_table"]);
  });
});

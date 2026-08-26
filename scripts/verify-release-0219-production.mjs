/**
 * Read-only verify for release 0.2.19 production migrations.
 *
 *   $env:DATABASE_URL="postgresql://postgres:...@db.nipqdarduknydqptqzup.supabase.co:5432/postgres"
 *   node scripts/verify-release-0219-production.mjs
 *
 * Or paste scripts/sql/VERIFY_RELEASE_0219_PRODUCTION.sql in Supabase SQL Editor.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { PRODUCTION_REF } from "./supabase-project-refs.mjs";

const EXPECTED_VERSIONS = [
  "112",
  "140",
  "141",
  "142",
  "143",
  "144",
  "20260826114420",
  "20260826114605",
  "20260826114630",
  "20260826120601",
  "20260826120735",
  "20260826120822",
  "20260826123241",
  "20260826123459",
  "20260826123700",
  "20260826140000",
  "20260826151000",
];

const CIE10_SOURCE = "cie10-es-lista-tabular-enfermedades-pdf";

function loadDbUrl() {
  const envLocal = resolve(process.cwd(), ".env.local");
  if (existsSync(envLocal)) {
    for (const line of readFileSync(envLocal, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const m = trimmed.match(/^DATABASE_URL=(.+)$/);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  return process.env.DATABASE_URL?.trim() ?? null;
}

function query(dbUrl, sql) {
  const tmp = resolve(process.cwd(), `.tmp-verify-${Date.now()}.sql`);
  writeFileSync(tmp, sql, "utf8");
  try {
    const r = spawnSync(
      "npx",
      ["supabase", "db", "query", "--db-url", dbUrl, "-f", tmp, "--output-format", "json"],
      { encoding: "utf8", shell: true }
    );
    const text = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
    if (r.status !== 0 || /LegacyDbQueryUnexpectedStatusError/i.test(text)) {
      throw new Error(text.slice(0, 800));
    }
    const line = text.split("\n").find((l) => l.trim().startsWith("{"));
    return line ? JSON.parse(line) : { rows: [] };
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

function main() {
  const dbUrl = loadDbUrl();
  if (!dbUrl?.includes(PRODUCTION_REF)) {
    console.error(`Set DATABASE_URL targeting ${PRODUCTION_REF} (or add to .env.local).`);
    console.error(`Alternatively run: scripts/sql/VERIFY_RELEASE_0219_PRODUCTION.sql in SQL Editor.`);
    process.exit(1);
  }

  const checks = [];
  const fail = (name, detail) => checks.push({ name, ok: false, detail });
  const pass = (name, detail) => checks.push({ name, ok: true, detail });

  const versions = query(
    dbUrl,
    `SELECT version FROM supabase_migrations.schema_migrations WHERE version IN (${EXPECTED_VERSIONS.map((v) => `'${v}'`).join(",")}) ORDER BY version;`
  );
  const applied = new Set((versions.rows ?? []).map((r) => String(r.version)));
  const missing = EXPECTED_VERSIONS.filter((v) => !applied.has(v));
  if (missing.length === 0) pass("schema_migrations", `All ${EXPECTED_VERSIONS.length} release versions registered`);
  else fail("schema_migrations", `Missing: ${missing.join(", ")}`);

  const rpc = query(
    dbUrl,
    `SELECT has_function_privilege('authenticated', 'search_clinical_diagnoses(text, integer)', 'EXECUTE') AS exec;`
  );
  if (rpc.rows?.[0]?.exec === true) pass("search_clinical_diagnoses EXECUTE", "authenticated can call RPC");
  else fail("search_clinical_diagnoses EXECUTE", String(rpc.rows?.[0]?.exec ?? "unknown"));

  const counts = query(
    dbUrl,
    `SELECT
       (SELECT count(*)::int FROM clinical_diagnoses WHERE active = true) AS active_cnt,
       (SELECT count(*)::int FROM clinical_diagnoses WHERE source = '${CIE10_SOURCE}') AS cie10_cnt,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clinical_diagnoses' AND column_name='source') AS has_source_col,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='professionals' AND column_name='cuil') AS has_prof_cuil,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='patients' AND column_name='cuir_formatted') AS has_patient_cuir,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clinics' AND column_name='is_fiscalization') AS has_fiscalization;`
  );
  const c = counts.rows?.[0] ?? {};
  if (c.has_source_col) pass("clinical_diagnoses.source column", "present (143)");
  else fail("clinical_diagnoses.source column", "missing — run 143");

  if (Number(c.cie10_cnt) >= 600) pass("CIE-10 catalog rows", `${c.cie10_cnt} rows`);
  else if (Number(c.active_cnt) > 0)
    fail("CIE-10 catalog rows", `only ${c.cie10_cnt ?? 0} CIE-10 rows — run: npm run apply:clinical-diagnoses:production (--import-only if SQL done)`);
  else fail("CIE-10 catalog rows", "no catalog data — run import");

  if (c.has_prof_cuil) pass("ReNaPDiS Phase 1", "professionals.cuil present");
  else fail("ReNaPDiS Phase 1", "professionals.cuil missing");

  if (c.has_patient_cuir) pass("ReNaPDiS Phase 2", "patients.cuir_formatted present");
  else fail("ReNaPDiS Phase 2", "patients.cuir_formatted missing");

  if (c.has_fiscalization) pass("ReNaPDiS Phase 3", "clinics.is_fiscalization present");
  else fail("ReNaPDiS Phase 3", "clinics.is_fiscalization missing");

  const portal = query(
    dbUrl,
    `SELECT EXISTS (
       SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'validate_patient_portal_session_v2'
     ) AS portal_v2;`
  );
  if (portal.rows?.[0]?.portal_v2) pass("Phase 6 portal RPC", "validate_patient_portal_session_v2 exists");
  else fail("Phase 6 portal RPC", "missing");

  console.log("\nRelease 0.2.19 production verification\n");
  for (const chk of checks) {
    console.log(`${chk.ok ? "OK" : "FAIL"}  ${chk.name}`);
    if (chk.detail) console.log(`      ${chk.detail}`);
  }
  const failed = checks.filter((c) => !c.ok);
  console.log(failed.length === 0 ? "\nALL CHECKS PASSED\n" : `\n${failed.length} CHECK(S) FAILED\n`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main();

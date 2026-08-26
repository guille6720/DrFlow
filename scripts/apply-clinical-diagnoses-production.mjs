/**
 * Apply clinical diagnosis catalog (112 + 143) and CIE-10 import to PRODUCTION only.
 *
 * PowerShell:
 *   cd c:\dev\DrFlow-staging
 *   $env:ALLOW_PRODUCTION_DB="1"
 *   $env:CONFIRM_PRODUCTION_DB="nipqdarduknydqptqzup"
 *   $env:DATABASE_URL="postgresql://postgres:TU_PASSWORD@db.nipqdarduknydqptqzup.supabase.co:5432/postgres"
 *   node scripts/apply-clinical-diagnoses-production.mjs
 *
 * Dry-run (no SQL/import):
 *   node scripts/apply-clinical-diagnoses-production.mjs --dry-run
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { PRODUCTION_REF } from "./supabase-project-refs.mjs";

const DRY_RUN = process.argv.includes("--dry-run");
const MIGRATIONS = [
  "supabase/migrations/112_clinical_diagnoses_catalog.sql",
  "supabase/migrations/143_clinical_diagnoses_cie10_import.sql",
];
const JSON_PATH = resolve(process.cwd(), "data/lista-tabular-enfermedades.normalized.json");
const SOURCE = "cie10-es-lista-tabular-enfermedades-pdf";
const BATCH = 80;

function fail(msg) {
  console.error(`\nERROR: ${msg}\n`);
  process.exit(1);
}

function sqlEscape(value) {
  return String(value ?? "").replace(/'/g, "''");
}

function sqlText(value) {
  if (value == null || value === "") return "NULL";
  return `'${sqlEscape(value)}'`;
}

function sqlTextArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "'{}'::text[]";
  return `ARRAY[${arr.map((s) => sqlText(s)).join(", ")}]::text[]`;
}

function assertProductionEnv() {
  if (process.env.ALLOW_PRODUCTION_DB !== "1") {
    fail(`Set ALLOW_PRODUCTION_DB=1 explicitly.`);
  }
  if (process.env.CONFIRM_PRODUCTION_DB !== PRODUCTION_REF) {
    fail(`Set CONFIRM_PRODUCTION_DB=${PRODUCTION_REF}.`);
  }
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    fail("Set DATABASE_URL to the production Postgres connection string.");
  }
  if (!dbUrl.includes(PRODUCTION_REF)) {
    fail(`DATABASE_URL must target production ref ${PRODUCTION_REF}.`);
  }
  return dbUrl;
}

function runSqlFile(dbUrl, relativePath) {
  const abs = resolve(process.cwd(), relativePath);
  if (!existsSync(abs)) fail(`Missing migration file: ${relativePath}`);
  console.log(`Applying ${relativePath} ...`);
  const result = spawnSync(
    "npx",
    ["supabase", "db", "query", "--db-url", dbUrl, "-f", abs],
    { encoding: "utf8", shell: true, stdio: "pipe" }
  );
  const text = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (result.status !== 0 || /LegacyDbQueryUnexpectedStatusError|ERROR:/i.test(text)) {
    console.error(text);
    fail(`Failed applying ${relativePath}`);
  }
  console.log(`OK ${relativePath}`);
}

function dbQuery(dbUrl, sql) {
  const tmp = resolve(process.cwd(), `.tmp-prod-dx-${Date.now()}.sql`);
  writeFileSync(tmp, sql, "utf8");
  try {
    const result = spawnSync(
      "npx",
      ["supabase", "db", "query", "--db-url", dbUrl, "-f", tmp, "--output-format", "json"],
      { encoding: "utf8", shell: true }
    );
    const text = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    if (result.status !== 0 || /LegacyDbQueryUnexpectedStatusError/i.test(text)) {
      throw new Error(text || "db query failed");
    }
    return text;
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

function buildUpsertBatch(batch) {
  const values = batch
    .map(
      (r) =>
        `(${sqlText(r.name)}, ${sqlText(r.code)}, ${sqlText(r.category)}, ${sqlTextArray(
          r.synonyms
        )}, true, ${sqlText(SOURCE)}, ${sqlText(r.source_version)}, ${sqlText(
          r.parent_code
        )}, ${r.level == null ? "NULL" : Number(r.level)})`
    )
    .join(",\n  ");

  return `
WITH incoming(name, cie10_code, category, synonyms, active, source, source_version, parent_code, level) AS (
  VALUES
  ${values}
),
updated AS (
  UPDATE clinical_diagnoses d SET
    name = i.name,
    category = i.category,
    synonyms = i.synonyms,
    active = true,
    source_version = i.source_version,
    parent_code = i.parent_code,
    level = i.level::smallint,
    updated_at = now()
  FROM incoming i
  WHERE d.source = ${sqlText(SOURCE)} AND d.cie10_code = i.cie10_code
  RETURNING d.cie10_code
),
inserted AS (
  INSERT INTO clinical_diagnoses (
    name, cie10_code, category, synonyms, active, source, source_version, parent_code, level
  )
  SELECT i.name, i.cie10_code, i.category, i.synonyms, true, i.source, i.source_version, i.parent_code, i.level::smallint
  FROM incoming i
  WHERE NOT EXISTS (
    SELECT 1 FROM clinical_diagnoses d
    WHERE d.source = ${sqlText(SOURCE)} AND d.cie10_code = i.cie10_code
  )
  RETURNING cie10_code
)
SELECT
  (SELECT count(*) FROM updated) AS updated_count,
  (SELECT count(*) FROM inserted) AS inserted_count;
`;
}

if (DRY_RUN) {
  console.log(
    JSON.stringify(
      {
        mode: "dry-run",
        target: PRODUCTION_REF,
        migrations: MIGRATIONS,
        json: JSON_PATH,
        json_exists: existsSync(JSON_PATH),
      },
      null,
      2
    )
  );
  process.exit(0);
}

const dbUrl = assertProductionEnv();

for (const mig of MIGRATIONS) {
  runSqlFile(dbUrl, mig);
}

if (!existsSync(JSON_PATH)) {
  fail(`Missing ${JSON_PATH}. Run npm run parse:diagnoses first.`);
}

const diagnoses = JSON.parse(readFileSync(JSON_PATH, "utf8")).diagnoses ?? [];
console.log(`Importing ${diagnoses.length} diagnoses to production ...`);

let inserted = 0;
let updated = 0;
for (let i = 0; i < diagnoses.length; i += BATCH) {
  const chunk = diagnoses.slice(i, i + BATCH);
  const out = dbQuery(dbUrl, buildUpsertBatch(chunk));
  const mUp = out.match(/"updated_count"\s*:\s*(\d+)/);
  const mIn = out.match(/"inserted_count"\s*:\s*(\d+)/);
  if (mUp) updated += Number(mUp[1]);
  if (mIn) inserted += Number(mIn[1]);
  console.log(`  batch ${i / BATCH + 1}: ${chunk.length} rows`);
}

const verify = dbQuery(
  dbUrl,
  `SELECT count(*)::int AS n FROM clinical_diagnoses WHERE source = '${SOURCE}';
   SELECT proname FROM pg_proc JOIN pg_namespace n ON n.oid = pg_proc.pronamespace
   WHERE n.nspname = 'public' AND proname = 'search_clinical_diagnoses';`
);

console.log(
  JSON.stringify(
    {
      target: PRODUCTION_REF,
      imported_source_rows: verify.match(/"n"\s*:\s*(\d+)/)?.[1] ?? null,
      inserted,
      updated,
      rpc_present: /search_clinical_diagnoses/.test(verify),
      finished_at: new Date().toISOString(),
    },
    null,
    2
  )
);
console.log("PRODUCTION_CLINICAL_DIAGNOSES_OK");

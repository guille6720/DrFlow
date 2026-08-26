/**
 * Idempotent import of CIE-10-ES diagnoses into clinical_diagnoses (STAGING ONLY).
 *
 * Prerequisites:
 *   - Parse: node scripts/parse-cie10es-diagnoses.mjs
 *   - Migration 143 applied on staging
 *   - CLI linked to gprmsufvhabntbrytwyi
 *
 * Usage (PowerShell):
 *   node scripts/import-diagnoses.mjs              # dry-run report
 *   $env:ALLOW_STAGING_DIAGNOSIS_IMPORT="1"
 *   $env:CONFIRM_STAGING_PROJECT_REF="gprmsufvhabntbrytwyi"
 *   node scripts/import-diagnoses.mjs --apply
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  assertLinkedStagingOrExit,
  PRODUCTION_REF,
  STAGING_REF,
} from "./supabase-project-refs.mjs";

const SOURCE = "cie10-es-lista-tabular-enfermedades-pdf";
const JSON_PATH = resolve(process.cwd(), "data/lista-tabular-enfermedades.normalized.json");
const REPORT_PATH = resolve(
  process.cwd(),
  "data/lista-tabular-enfermedades.import-report.json"
);
const APPLY = process.argv.includes("--apply");
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

function dbFile(sql) {
  assertLinkedStagingOrExit();
  const tmp = resolve(
    process.cwd(),
    `.tmp-dx-import-${Date.now()}-${Math.random().toString(16).slice(2)}.sql`
  );
  writeFileSync(tmp, sql, "utf8");
  try {
    const result = spawnSync(
      "npx",
      [
        "supabase",
        "db",
        "query",
        "--linked",
        "--project-ref",
        STAGING_REF,
        "--file",
        tmp,
        "--output-format",
        "json",
      ],
      { encoding: "utf8", shell: true }
    );
    const text = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    if (
      result.status !== 0 ||
      /_tag":"Error"|LegacyDbQueryUnexpectedStatusError|ERROR:/.test(text)
    ) {
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
    .map((r) => {
      return `(${sqlText(r.name)}, ${sqlText(r.code)}, ${sqlText(r.category)}, ${sqlTextArray(
        r.synonyms
      )}, true, ${sqlText(SOURCE)}, ${sqlText(r.source_version)}, ${sqlText(
        r.parent_code
      )}, ${r.level == null ? "NULL" : Number(r.level)})`;
    })
    .join(",\n  ");

  // Upsert via unique index on (cie10_code) WHERE source = import source.
  // Postgres ON CONFLICT requires a constraint; use DELETE+INSERT pattern per batch
  // guarded by source, or INSERT ... ON CONFLICT on the partial unique index
  // (supported in PG 15+ with inference). Prefer explicit merge:
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
  WHERE d.source = ${sqlText(SOURCE)}
    AND d.cie10_code = i.cie10_code
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

if (!existsSync(JSON_PATH)) {
  fail(`Missing ${JSON_PATH}. Run: node scripts/parse-cie10es-diagnoses.mjs`);
}

const payload = JSON.parse(readFileSync(JSON_PATH, "utf8"));
const diagnoses = Array.isArray(payload.diagnoses) ? payload.diagnoses : [];
if (diagnoses.length === 0) fail("No diagnoses in normalized JSON.");

const dryReport = {
  mode: APPLY ? "apply" : "dry-run",
  target: STAGING_REF,
  source: SOURCE,
  total: diagnoses.length,
  sample_first: diagnoses.slice(0, 5).map((d) => ({ code: d.code, name: d.name })),
  sample_last: diagnoses.slice(-5).map((d) => ({ code: d.code, name: d.name })),
  note: "Does not delete existing diagnoses. Upserts only rows with this source. Seed/manual rows untouched.",
};

console.log(JSON.stringify(dryReport, null, 2));

if (!APPLY) {
  writeFileSync(REPORT_PATH, JSON.stringify(dryReport, null, 2), "utf8");
  console.log(`\nDry-run only. Wrote ${REPORT_PATH}`);
  console.log("To apply on staging:");
  console.log('  $env:ALLOW_STAGING_DIAGNOSIS_IMPORT="1"');
  console.log(`  $env:CONFIRM_STAGING_PROJECT_REF="${STAGING_REF}"`);
  console.log("  node scripts/import-diagnoses.mjs --apply");
  process.exit(0);
}

if (process.env.ALLOW_STAGING_DIAGNOSIS_IMPORT !== "1") {
  fail('Set ALLOW_STAGING_DIAGNOSIS_IMPORT=1 after reviewing dry-run.');
}
if (process.env.CONFIRM_STAGING_PROJECT_REF !== STAGING_REF) {
  fail(`Set CONFIRM_STAGING_PROJECT_REF=${STAGING_REF}`);
}
if (
  process.env.ALLOW_PRODUCTION_DB === "1" ||
  process.env.CONFIRM_PRODUCTION_DB ||
  process.env.CONFIRM_STAGING_PROJECT_REF === PRODUCTION_REF
) {
  fail("Production confirmation detected. Aborting.");
}

assertLinkedStagingOrExit();

// Ensure import columns exist (migration 143); soft-check
try {
  dbFile(`SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clinical_diagnoses' AND column_name='source' LIMIT 1;`);
} catch (e) {
  fail(
    `Staging DB missing clinical_diagnoses.source. Apply migration 143 first.\n${e instanceof Error ? e.message : e}`
  );
}

let updated = 0;
let inserted = 0;
const batchErrors = [];

for (let i = 0; i < diagnoses.length; i += BATCH) {
  const chunk = diagnoses.slice(i, i + BATCH);
  try {
    const out = dbFile(buildUpsertBatch(chunk));
    const mUp = out.match(/"updated_count"\s*:\s*"?(\d+)/);
    const mIn = out.match(/"inserted_count"\s*:\s*"?(\d+)/);
    // Also try plain table output
    const nums = [...out.matchAll(/\b(\d+)\b/g)].map((x) => Number(x[1]));
    if (mUp) updated += Number(mUp[1]);
    if (mIn) inserted += Number(mIn[1]);
    if (!mUp && !mIn && nums.length >= 2) {
      // fragile fallback — ignore
    }
    console.log(`Batch ${i / BATCH + 1}: rows ${i + 1}-${i + chunk.length}`);
  } catch (e) {
    batchErrors.push({
      from: i,
      to: i + chunk.length,
      error: e instanceof Error ? e.message.slice(0, 500) : String(e).slice(0, 500),
    });
    console.error(`Batch failed at ${i}:`, e instanceof Error ? e.message : e);
    break;
  }
}

let dbCount = null;
try {
  const countOut = dbFile(
    `SELECT count(*)::int AS n FROM clinical_diagnoses WHERE source = '${SOURCE}';`
  );
  const m = countOut.match(/"n"\s*:\s*(\d+)/) || countOut.match(/\b(\d{2,4})\b/);
  if (m) dbCount = Number(m[1]);
} catch {
  /* ignore */
}

const finalReport = {
  ...dryReport,
  updated,
  inserted,
  db_count_for_source: dbCount,
  batch_errors: batchErrors,
  finished_at: new Date().toISOString(),
};

mkdirSync(resolve(process.cwd(), "data"), { recursive: true });
writeFileSync(REPORT_PATH, JSON.stringify(finalReport, null, 2), "utf8");
console.log(JSON.stringify(finalReport, null, 2));

if (batchErrors.length) process.exit(2);
if (dbCount != null && dbCount < diagnoses.length) {
  console.error("WARNING: DB count lower than source diagnoses.");
  process.exit(2);
}
console.log("IMPORT_OK");

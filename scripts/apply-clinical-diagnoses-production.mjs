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
 *
 * Check schema readiness:
 *   node scripts/apply-clinical-diagnoses-production.mjs --diagnose
 *
 * Migrations-only (112 + 143 + 144, single pg connection):
 *   node scripts/apply-clinical-diagnoses-production.mjs --migrations-only
 *
 * Resume partial 112 (statements 25–26 after connection timeout):
 *   node scripts/apply-clinical-diagnoses-production.mjs --migrations-only --from-file=112 --from-statement=25
 *
 * Import only (requires --diagnose OK first):
 *   node scripts/apply-clinical-diagnoses-production.mjs --import-only
 *
 * Verify only (after import):
 *   node scripts/apply-clinical-diagnoses-production.mjs --verify-only
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PRODUCTION_REF } from "./supabase-project-refs.mjs";
import { queryJson, runSqlFile } from "./lib/exec-sql-file.mjs";

const DRY_RUN = process.argv.includes("--dry-run");
const IMPORT_ONLY = process.argv.includes("--import-only");
const VERIFY_ONLY = process.argv.includes("--verify-only");
const MIGRATIONS_ONLY = process.argv.includes("--migrations-only");
const DIAGNOSE = process.argv.includes("--diagnose");
const MIGRATIONS = [
  "supabase/migrations/112_clinical_diagnoses_catalog.sql",
  "supabase/migrations/143_clinical_diagnoses_cie10_import.sql",
  "supabase/migrations/144_clinical_diagnoses_rls_select_authenticated.sql",
  "supabase/migrations/145_clinical_diagnoses_search_grants.sql",
];
const JSON_PATH = resolve(process.cwd(), "data/lista-tabular-enfermedades.normalized.json");
const SOURCE = "cie10-es-lista-tabular-enfermedades-pdf";
const BATCH = 80;

function parseArg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
}

const FROM_FILE = parseArg("from-file");
const FROM_STATEMENT = Math.max(1, Number(parseArg("from-statement")) || 1);

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
  (SELECT count(*)::int FROM updated) AS updated_count,
  (SELECT count(*)::int FROM inserted) AS inserted_count;
`;
}

async function collectDiagnose(dbUrl) {
  const [row] = await queryJson(
    dbUrl,
    `SELECT
       to_regclass('public.clinical_diagnoses') IS NOT NULL AS table_ok,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'clinical_diagnoses' AND column_name = 'source'
       ) AS source_col_ok,
       EXISTS (
         SELECT 1 FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'search_clinical_diagnoses'
       ) AS rpc_ok,
       EXISTS (
         SELECT 1 FROM pg_indexes
         WHERE schemaname = 'public'
           AND tablename = 'clinical_diagnoses'
           AND indexname = 'clinical_diagnoses_cie10_import_uidx'
       ) AS import_index_ok;`
  );

  let cie10 = 0;
  let seedRows = 0;
  if (row?.table_ok) {
    if (row.source_col_ok) {
      const [cnt] = await queryJson(
        dbUrl,
        `SELECT count(*)::int AS n FROM clinical_diagnoses WHERE source = ${sqlText(SOURCE)};`
      );
      cie10 = cnt?.n ?? 0;
    }
    const [seed] = await queryJson(
      dbUrl,
      `SELECT count(*)::int AS n FROM clinical_diagnoses WHERE source IS NULL;`
    );
    seedRows = seed?.n ?? 0;
  }

  const applied = await queryJson(
    dbUrl,
    `SELECT version FROM supabase_migrations.schema_migrations
     WHERE version IN ('112', '143', '144', '145')
     ORDER BY version;`
  );

  return {
    target: PRODUCTION_REF,
    clinical_diagnoses_table: Boolean(row?.table_ok),
    source_column: Boolean(row?.source_col_ok),
    import_unique_index: Boolean(row?.import_index_ok),
    search_rpc: Boolean(row?.rpc_ok),
    cie10_rows: cie10,
    seed_rows: seedRows,
    schema_migrations: applied.map((r) => String(r.version)),
    ready_for_import: Boolean(row?.table_ok && row?.source_col_ok && row?.import_index_ok && row?.rpc_ok),
  };
}

async function assertReadyForImport(dbUrl) {
  const report = await collectDiagnose(dbUrl);
  if (!report.ready_for_import) {
    console.error(JSON.stringify(report, null, 2));
    fail(
      "Production DB is not ready for CIE-10 import. Run migrations first:\n" +
        "  node scripts/apply-clinical-diagnoses-production.mjs --migrations-only\n" +
        "If 112 stopped mid-file:\n" +
        "  node scripts/apply-clinical-diagnoses-production.mjs --migrations-only --from-file=112 --from-statement=25"
    );
  }
  return report;
}

async function explainImportFailure(dbUrl, chunk) {
  const report = await collectDiagnose(dbUrl);
  console.error("\nSchema snapshot:");
  console.error(JSON.stringify(report, null, 2));
  const sample = chunk[0];
  if (!sample) return;
  try {
    const testSql = `
INSERT INTO clinical_diagnoses (
  name, cie10_code, category, synonyms, active, source, source_version, parent_code, level
) VALUES (
  ${sqlText(sample.name)}, ${sqlText(sample.code)}, ${sqlText(sample.category)}, ${sqlTextArray(sample.synonyms)},
  true, ${sqlText(SOURCE)}, ${sqlText(sample.source_version)}, ${sqlText(sample.parent_code)},
  ${sample.level == null ? "NULL" : Number(sample.level)}
)
RETURNING id;`;
    const rows = await queryJson(dbUrl, testSql);
    console.error("\nSingle-row test insert succeeded:", rows[0]?.id);
    await queryJson(
      dbUrl,
      `DELETE FROM clinical_diagnoses
       WHERE source = ${sqlText(SOURCE)} AND cie10_code = ${sqlText(sample.code)};`
    );
  } catch (err) {
    console.error("\nSingle-row test insert failed:", err.message);
  }
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

(async () => {
  if (DIAGNOSE) {
    console.log(JSON.stringify(await collectDiagnose(dbUrl), null, 2));
    process.exit(0);
  }

  if (VERIFY_ONLY) {
    const report = await collectDiagnose(dbUrl);
    console.log(
      JSON.stringify(
        {
          target: PRODUCTION_REF,
          imported_source_rows: report.cie10_rows,
          rpc_present: report.search_rpc,
          ready_for_import: report.ready_for_import,
          schema_migrations: report.schema_migrations,
        },
        null,
        2
      )
    );
    process.exit(report.cie10_rows >= 600 && report.search_rpc ? 0 : 1);
  }

  if (!IMPORT_ONLY) {
    for (const mig of MIGRATIONS) {
      const fileNum = mig.match(/(\d{3})_/)?.[1];
      const fromStatement = FROM_FILE && fileNum === FROM_FILE ? FROM_STATEMENT : 1;
      try {
        await runSqlFile(dbUrl, mig, { fromStatement });
      } catch (err) {
        fail(err.message ?? String(err));
      }
    }
    for (const mig of MIGRATIONS) {
      const version = mig.match(/^(\d{3})_/)?.[1] ?? mig.match(/^(20\d{12})_/)?.[1];
      if (version) {
        await queryJson(
          dbUrl,
          `INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('${version}') ON CONFLICT DO NOTHING;`
        );
      }
    }
  }

  if (MIGRATIONS_ONLY) {
    const report = await collectDiagnose(dbUrl);
    console.log(JSON.stringify(report, null, 2));
    if (!report.ready_for_import) {
      fail("Migrations finished but schema is still incomplete. Check errors above and re-run if needed.");
    }
    console.log("\nMigrations OK. Next step:");
    console.log("  node scripts/apply-clinical-diagnoses-production.mjs --import-only\n");
    process.exit(0);
  }

  await assertReadyForImport(dbUrl);

  if (!existsSync(JSON_PATH)) {
    fail(`Missing ${JSON_PATH}. Run npm run parse:diagnoses first.`);
  }

  const diagnoses = JSON.parse(readFileSync(JSON_PATH, "utf8")).diagnoses ?? [];
  console.log(`Importing ${diagnoses.length} diagnoses to production ...`);

  let inserted = 0;
  let updated = 0;
  for (let i = 0; i < diagnoses.length; i += BATCH) {
    const chunk = diagnoses.slice(i, i + BATCH);
    const [counts] = await queryJson(dbUrl, buildUpsertBatch(chunk));
    const batchInserted = Number(counts?.inserted_count ?? 0);
    const batchUpdated = Number(counts?.updated_count ?? 0);
    updated += batchUpdated;
    inserted += batchInserted;
    console.log(
      `  batch ${i / BATCH + 1}: ${chunk.length} rows (inserted ${batchInserted}, updated ${batchUpdated})`
    );
    if (batchInserted === 0 && batchUpdated === 0 && i === 0) {
      await explainImportFailure(dbUrl, chunk);
      fail("First batch inserted/updated 0 rows — see schema snapshot and test insert above.");
    }
  }

  const report = await collectDiagnose(dbUrl);

  console.log(
    JSON.stringify(
      {
        target: PRODUCTION_REF,
        imported_source_rows: report.cie10_rows,
        inserted,
        updated,
        rpc_present: report.search_rpc,
        finished_at: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log("PRODUCTION_CLINICAL_DIAGNOSES_OK");
})().catch((err) => fail(err.message ?? String(err)));

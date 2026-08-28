#!/usr/bin/env node
/**
 * Staging-only query performance snapshot (pg_stat_statements + safe EXPLAIN).
 * Never prints PHI, credentials, or full query literals with patient data.
 *
 * Usage: node scripts/staging-query-performance.mjs [--json]
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { stagingDbQuery } from "./lib/staging-db-query.mjs";
import {
  assertLinkedStagingOrExit,
  readLinkedProjectRef,
  STAGING_REF,
} from "./supabase-project-refs.mjs";

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

assertLinkedStagingOrExit();
if (readLinkedProjectRef() !== STAGING_REF) {
  fail(`CLI must be linked to staging (${STAGING_REF}).`);
}

const SYNTHETIC_CLINIC = "a0000000-0000-4000-8000-000000000001";

const report = {
  captured_at: new Date().toISOString(),
  staging_ref: STAGING_REF,
  pg_stat_statements: { enabled: false, error: null, top_total_time: [], top_mean_time: [], top_calls: [] },
  explain: [],
};

try {
  const ext = stagingDbQuery(`
SELECT extname, extversion
FROM pg_extension
WHERE extname = 'pg_stat_statements';
`);
  report.pg_stat_statements.enabled = (ext.rows?.length ?? 0) > 0;

  if (report.pg_stat_statements.enabled) {
    const topTotal = stagingDbQuery(`
SELECT
  LEFT(regexp_replace(query, E'[\\n\\r\\t]+', ' ', 'g'), 180) AS query_preview,
  calls::bigint AS calls,
  round(total_exec_time::numeric, 2) AS total_ms,
  round(mean_exec_time::numeric, 2) AS mean_ms,
  rows::bigint AS rows
FROM extensions.pg_stat_statements
WHERE query NOT ILIKE '%pg_stat_statements%'
  AND query NOT ILIKE '%EXPLAIN%'
ORDER BY total_exec_time DESC
LIMIT 15;
`);
    report.pg_stat_statements.top_total_time = topTotal.rows ?? [];

    const topMean = stagingDbQuery(`
SELECT
  LEFT(regexp_replace(query, E'[\\n\\r\\t]+', ' ', 'g'), 180) AS query_preview,
  calls::bigint AS calls,
  round(mean_exec_time::numeric, 2) AS mean_ms,
  round(total_exec_time::numeric, 2) AS total_ms
FROM extensions.pg_stat_statements
WHERE calls >= 5
  AND query NOT ILIKE '%pg_stat_statements%'
ORDER BY mean_exec_time DESC
LIMIT 15;
`);
    report.pg_stat_statements.top_mean_time = topMean.rows ?? [];

    const topCalls = stagingDbQuery(`
SELECT
  LEFT(regexp_replace(query, E'[\\n\\r\\t]+', ' ', 'g'), 180) AS query_preview,
  calls::bigint AS calls,
  round(mean_exec_time::numeric, 2) AS mean_ms
FROM extensions.pg_stat_statements
WHERE query NOT ILIKE '%pg_stat_statements%'
ORDER BY calls DESC
LIMIT 15;
`);
    report.pg_stat_statements.top_calls = topCalls.rows ?? [];
  }
} catch (error) {
  report.pg_stat_statements.error = error instanceof Error ? error.message.slice(0, 500) : String(error);
}

const explainTargets = [
  {
    name: "clinical_records_by_clinic_patient",
    sql: `
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT id, patient_id, chief_complaint, diagnosis, created_at
FROM public.clinical_records
WHERE clinic_id = '${SYNTHETIC_CLINIC}'::uuid
ORDER BY created_at DESC
LIMIT 80;
`,
  },
  {
    name: "patients_list_by_clinic",
    sql: `
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT id, last_name, first_name, document_number
FROM public.patients
WHERE clinic_id = '${SYNTHETIC_CLINIC}'::uuid
ORDER BY last_name ASC
LIMIT 25;
`,
  },
  {
    name: "appointments_agenda_day",
    sql: `
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT id, patient_id, professional_id, start_at, status
FROM public.appointments
WHERE clinic_id = '${SYNTHETIC_CLINIC}'::uuid
  AND start_at >= date_trunc('day', now())
  AND start_at < date_trunc('day', now()) + interval '1 day'
ORDER BY start_at ASC
LIMIT 200;
`,
  },
];

for (const target of explainTargets) {
  try {
    const result = stagingDbQuery(target.sql);
    const planRow = result.rows?.[0];
    const plan = planRow?.["QUERY PLAN"]?.[0]?.Plan ?? planRow?.["QUERY PLAN"] ?? null;
    report.explain.push({
      name: target.name,
      plan_type: plan?.["Node Type"] ?? null,
      execution_time_ms: planRow?.["QUERY PLAN"]?.[0]?.["Execution Time"] ?? null,
      planning_time_ms: planRow?.["QUERY PLAN"]?.[0]?.["Planning Time"] ?? null,
      shared_hit_blocks: plan?.["Shared Hit Blocks"] ?? null,
      shared_read_blocks: plan?.["Shared Read Blocks"] ?? null,
    });
  } catch (error) {
    report.explain.push({
      name: target.name,
      error: error instanceof Error ? error.message.slice(0, 300) : String(error),
    });
  }
}

const outPath = resolve(process.cwd(), "coverage/staging-query-performance.json");
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log("OK: staging query performance snapshot");
console.log(`pg_stat_statements_enabled=${report.pg_stat_statements.enabled}`);
console.log(`explain_targets=${report.explain.length}`);
console.log(`wrote ${outPath}`);
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
}

process.exit(report.pg_stat_statements.enabled ? 0 : 2);

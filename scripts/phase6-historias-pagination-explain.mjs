#!/usr/bin/env node
/**
 * Phase 6 — EXPLAIN keyset vs OFFSET for historias pagination (staging only).
 * Writes coverage/phase6-historias-pagination-explain.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { stagingDbQuery } from "./lib/staging-db-query.mjs";
import { assertLinkedStagingOrExit, STAGING_REF } from "./supabase-project-refs.mjs";

const CLINIC = "a0000000-0000-4000-8000-000000000001";
const OUT = resolve(process.cwd(), "coverage/phase6-historias-pagination-explain.json");

assertLinkedStagingOrExit();

function explain(label, sql) {
  try {
    const result = stagingDbQuery(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)\n${sql}`);
    const rows = result.rows ?? result.result ?? [];
    const plan = rows[0]?.["QUERY PLAN"] ?? rows[0]?.query_plan ?? rows;
    return { label, ok: true, plan };
  } catch (err) {
    return { label, ok: false, error: String(err.message ?? err).slice(0, 800) };
  }
}

const page1 = explain(
  "keyset_page1",
  `SELECT id, created_at FROM clinical_records
   WHERE clinic_id = '${CLINIC}'::uuid
   ORDER BY created_at DESC, id DESC
   LIMIT 25;`
);

const deepOffset = explain(
  "offset_page_40",
  `SELECT id, created_at FROM clinical_records
   WHERE clinic_id = '${CLINIC}'::uuid
   ORDER BY created_at DESC, id DESC
   LIMIT 25 OFFSET 975;`
);

const keysetDeep = explain(
  "keyset_after_cursor",
  `SELECT id, created_at FROM clinical_records
   WHERE clinic_id = '${CLINIC}'::uuid
     AND (
       created_at < (SELECT created_at FROM clinical_records WHERE clinic_id = '${CLINIC}'::uuid ORDER BY created_at DESC, id DESC OFFSET 975 LIMIT 1)
       OR (
         created_at = (SELECT created_at FROM clinical_records WHERE clinic_id = '${CLINIC}'::uuid ORDER BY created_at DESC, id DESC OFFSET 975 LIMIT 1)
         AND id < (SELECT id FROM clinical_records WHERE clinic_id = '${CLINIC}'::uuid ORDER BY created_at DESC, id DESC OFFSET 975 LIMIT 1)
       )
     )
   ORDER BY created_at DESC, id DESC
   LIMIT 25;`
);

function execMs(entry) {
  try {
    const root = Array.isArray(entry.plan) ? entry.plan[0] : entry.plan;
    return root?.["Execution Time"] ?? root?.[0]?.["Execution Time"] ?? null;
  } catch {
    return null;
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  stagingRef: STAGING_REF,
  clinicId: CLINIC,
  results: [page1, deepOffset, keysetDeep].map((r) => ({
    ...r,
    executionMs: execMs(r),
  })),
};

mkdirSync(resolve(process.cwd(), "coverage"), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log("\n📊 Phase 6 — Historias pagination EXPLAIN\n");
for (const r of report.results) {
  console.log(`   ${r.ok ? "✓" : "✗"} ${r.label}: ${r.executionMs ?? r.error ?? "n/a"} ms`);
}
console.log(`\n→ ${OUT}\n`);

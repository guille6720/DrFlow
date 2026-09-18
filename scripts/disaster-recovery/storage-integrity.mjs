#!/usr/bin/env node
/**
 * Phase 5 — DB ↔ storage integrity checks for patient attachments (staging).
 * Detects orphan rows/objects, wrong clinic path, inaccessible objects.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { loadEnv } from "../_env.mjs";
import { requirePhase3Env } from "../lib/tenant-isolation-env.mjs";
import {
  assertLinkedStagingOrExit,
  PRODUCTION_REF,
  readLinkedProjectRef,
  STAGING_REF,
} from "../supabase-project-refs.mjs";

const BUCKET = "clinical-files";
const OUT = resolve(process.cwd(), "coverage/phase5-storage-integrity.json");

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

assertLinkedStagingOrExit();
if (readLinkedProjectRef() !== STAGING_REF) fail(`CLI must be linked to staging (${STAGING_REF}).`);

const phase3 = requirePhase3Env();

const env = loadEnv({ required: true });
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey) fail("Missing Supabase credentials.");
if (url.includes(PRODUCTION_REF)) fail("Refusing production URL.");

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const findings = [];
function add(id, severity, pass, detail) {
  findings.push({ id, severity, pass, detail });
}

const pathsToCheck = [];
if (phase3?.PHASE3_ATTACHMENT_B_PATH) {
  pathsToCheck.push({
    label: "phase3_synthetic",
    path: phase3.PHASE3_ATTACHMENT_B_PATH,
    expectedClinicId: phase3.PHASE3_CLINIC_B,
    expectedPatientId: phase3.PHASE3_PATIENT_B,
  });
}

for (const item of pathsToCheck) {
  const { data: rows } = await admin
    .from("patient_attachments")
    .select("id,clinic_id,patient_id,file_path,file_size")
    .eq("file_path", item.path);

  if (!rows?.length) {
    add(`${item.label}_db_missing`, "P0", false, "DB record without query match");
    continue;
  }

  const row = rows[0];
  add(`${item.label}_db_present`, "info", true, row.id);
  add(
    `${item.label}_clinic_path`,
    "P0",
    row.clinic_id === item.expectedClinicId,
    `db=${row.clinic_id} path_prefix=${item.path.split("/")[0]}`
  );
  add(
    `${item.label}_patient_match`,
    "P0",
    row.patient_id === item.expectedPatientId,
    `${row.patient_id}`
  );

  const prefix = item.path.split("/").slice(0, -1).join("/");
  const fileName = item.path.split("/").pop();
  const { data: listed, error: listErr } = await admin.storage.from(BUCKET).list(prefix, { limit: 50 });

  if (listErr) {
    add(`${item.label}_storage_list`, "P0", false, listErr.message);
    continue;
  }

  const obj = (listed ?? []).find((o) => o.name === fileName);
  if (!obj) {
    add(`${item.label}_object_missing`, "P1", false, "DB record without storage object");
    continue;
  }

  add(`${item.label}_object_present`, "info", true, obj.name);

  const { data: blob, error: dlErr } = await admin.storage.from(BUCKET).download(item.path);
  if (dlErr) {
    add(`${item.label}_object_inaccessible`, "P0", false, dlErr.message);
  } else {
    const text = await blob.text();
    const checksum = createHash("sha256").update(text).digest("hex");
    add(`${item.label}_object_readable`, "P0", true, `bytes=${text.length} sha256=${checksum.slice(0, 12)}`);
    if (row.file_size && row.file_size !== text.length) {
      add(`${item.label}_size_mismatch`, "P1", false, `db=${row.file_size} actual=${text.length}`);
    } else {
      add(`${item.label}_size_match`, "info", true, `${text.length}`);
    }
  }
}

// Sample orphan scan (limited, staging-safe)
const { data: sampleRows } = await admin
  .from("patient_attachments")
  .select("id,file_path,clinic_id")
  .eq("clinic_id", phase3?.PHASE3_CLINIC_B ?? "00000000-0000-0000-0000-000000000000")
  .limit(5);

let orphanObjects = 0;
for (const r of sampleRows ?? []) {
  const prefix = r.file_path.split("/").slice(0, -1).join("/");
  const fileName = r.file_path.split("/").pop();
  const { data: listed } = await admin.storage.from(BUCKET).list(prefix, { limit: 10 });
  if (!(listed ?? []).some((o) => o.name === fileName)) orphanObjects += 1;
}
add("sample_orphan_db_rows", orphanObjects ? "P1" : "info", orphanObjects === 0, `orphans=${orphanObjects}`);

const allPass = findings.every((f) => f.pass || f.severity === "info");
const report = {
  generatedAt: new Date().toISOString(),
  environment: "staging",
  bucket: BUCKET,
  pathsChecked: pathsToCheck.length,
  findings,
  allPass,
  databaseRecoveryNote: "Postgres backup/PITR restores patient_attachments rows with clinic_id FKs",
  objectStorageRecoveryNote:
    "Storage objects are NOT guaranteed by DB-only restore; verify with this script after any DR event",
};

mkdirSync(resolve(process.cwd(), "coverage"), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log("\n🔍 Phase 5 — Storage integrity\n");
for (const f of findings) {
  console.log(`   ${f.pass ? "✓" : "✗"} [${f.severity}] ${f.id}: ${f.detail}`);
}
console.log(`\n→ ${OUT}`);
console.log(allPass ? "\n✅ Storage integrity OK\n" : "\n❌ Storage gaps detected\n");
process.exit(allPass ? 0 : 1);

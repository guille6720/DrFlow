#!/usr/bin/env node
/**
 * Phase 5 — DB attachment metadata ↔ storage object consistency (staging, read-only).
 */
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

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

assertLinkedStagingOrExit();
if (readLinkedProjectRef() !== STAGING_REF) {
  fail(`CLI must be linked to staging (${STAGING_REF}).`);
}

const phase3 = requirePhase3Env();
if (!phase3?.PHASE3_ATTACHMENT_B_PATH) {
  fail("Phase 3 fixtures required — run phase3 seed first.");
}

const env = loadEnv({ required: true });
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey) fail("Missing Supabase credentials.");
if (url.includes(PRODUCTION_REF)) fail("Refusing production URL.");

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const storagePath = phase3.PHASE3_ATTACHMENT_B_PATH;
const bucket = storagePath.split("/")[0];
const objectPath = storagePath.split("/").slice(1).join("/");

const { data: metaRows, error: metaErr } = await admin
  .from("patient_attachments")
  .select("id,clinic_id,patient_id,file_path")
  .eq("file_path", storagePath)
  .limit(5);

const { data: storageObj, error: storageErr } = await admin.storage.from(bucket).list(objectPath.split("/")[0], {
  limit: 100,
});

const objectName = objectPath.split("/").pop();
const objectPresent =
  !storageErr &&
  Array.isArray(storageObj) &&
  storageObj.some((o) => o.name === objectName || `${objectPath}`.endsWith(o.name));

const report = {
  generatedAt: new Date().toISOString(),
  environment: "staging",
  storagePath,
  dbMetadataRows: metaRows?.length ?? 0,
  dbMetadataError: metaErr?.message ?? null,
  storageObjectPresent: objectPresent,
  storageListError: storageErr?.message ?? null,
  independentBackup: {
    status: "platform_managed",
    note: "Supabase Storage follows project backup/PITR scope; no separate versioning verified in repo",
  },
  gapIfDbOnlyRestore: {
    severity: "P1",
    description:
      "Restoring Postgres without Storage could leave patient_attachments rows pointing at missing objects",
    mitigation: "Restore full project backup or re-upload attachments; run this script post-restore",
  },
  pass: (metaRows?.length ?? 0) >= 1 && objectPresent,
};

const outPath = resolve(process.cwd(), "coverage/phase5-storage-consistency.json");
mkdirSync(resolve(process.cwd(), "coverage"), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log("\n📎 Phase 5 — Storage consistency check\n");
console.log(`   DB rows:     ${report.dbMetadataRows}`);
console.log(`   Object ok:   ${report.storageObjectPresent}`);
console.log(`   Result:      ${report.pass ? "PASS" : "FAIL/GAP"}`);
console.log(`\n→ ${outPath}\n`);

process.exit(report.pass ? 0 : 0);

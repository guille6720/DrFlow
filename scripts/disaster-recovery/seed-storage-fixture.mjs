#!/usr/bin/env node
/**
 * Phase 5 — upload synthetic non-PHI storage object for DR fixture (staging only).
 * Pairs DB patient_attachments row (Phase 3) with actual bucket object.
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
/** Minimal valid PDF — bucket allows application/pdf only (migration 028). */
const SYNTHETIC_CONTENT = Buffer.from(
  "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
  "utf8"
);
const OUT = resolve(process.cwd(), "coverage/phase5-storage-fixture.json");

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

assertLinkedStagingOrExit();
if (readLinkedProjectRef() !== STAGING_REF) fail(`CLI must be linked to staging (${STAGING_REF}).`);

const phase3 = requirePhase3Env();
if (!phase3?.PHASE3_ATTACHMENT_B_PATH) {
  fail("Phase 3 fixtures required — run npm run phase3:seed:staging-tenant first.");
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
const checksum = createHash("sha256").update(SYNTHETIC_CONTENT).digest("hex");

const { error: uploadErr } = await admin.storage.from(BUCKET).upload(storagePath, SYNTHETIC_CONTENT, {
  contentType: "application/pdf",
  upsert: true,
});

if (uploadErr) fail(`Storage upload: ${uploadErr.message}`);

await admin
  .from("patient_attachments")
  .update({ file_size: SYNTHETIC_CONTENT.length, file_type: "application/pdf" })
  .eq("file_path", storagePath);

const { data: metaRows } = await admin
  .from("patient_attachments")
  .select("id,clinic_id,patient_id,file_path,file_size")
  .eq("file_path", storagePath)
  .limit(1);

const { data: listed } = await admin.storage.from(BUCKET).list(
  storagePath.split("/").slice(0, -1).join("/"),
  { limit: 20 }
);
const fileName = storagePath.split("/").pop();
const objectPresent = (listed ?? []).some((o) => o.name === fileName);

const report = {
  generatedAt: new Date().toISOString(),
  environment: "staging",
  bucket: BUCKET,
  storagePath,
  dbRowPresent: (metaRows?.length ?? 0) >= 1,
  storageObjectPresent: objectPresent,
  contentChecksumSha256: checksum,
  bytes: SYNTHETIC_CONTENT.length,
  pass: (metaRows?.length ?? 0) >= 1 && objectPresent,
};

mkdirSync(resolve(process.cwd(), "coverage"), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log("\n📎 Phase 5 — Storage fixture seeded\n");
console.log(`   Path:    ${storagePath}`);
console.log(`   DB row:  ${report.dbRowPresent}`);
console.log(`   Object:  ${report.storageObjectPresent}`);
console.log(`   SHA256:  ${checksum.slice(0, 16)}…`);
console.log(`\n→ ${OUT}\n`);

process.exit(report.pass ? 0 : 1);

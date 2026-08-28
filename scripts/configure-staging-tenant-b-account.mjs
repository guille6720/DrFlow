#!/usr/bin/env node
/**
 * Provision User B for Clinic B tenant-isolation probes (STAGING ONLY).
 * Writes E2E_TENANT_B_EMAIL / E2E_TENANT_B_PASSWORD into .env.local.
 *
 * Usage: node scripts/configure-staging-tenant-b-account.mjs
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { loadEnv } from "./_env.mjs";
import {
  loadPhase3Env,
  STAGING_TENANT_B_EMAIL,
} from "./lib/tenant-isolation-env.mjs";
import {
  assertLinkedStagingOrExit,
  PRODUCTION_REF,
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

const phase3 = loadPhase3Env();
const clinicB = phase3?.PHASE3_CLINIC_B;
if (!clinicB) {
  fail("Missing PHASE3_CLINIC_B — run node scripts/phase3-seed-staging-tenant-fixtures.mjs first.");
}

const env = loadEnv({ required: true });
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey) fail("Missing staging Supabase credentials.");
if (url.includes(PRODUCTION_REF)) fail("Refusing production Supabase URL.");

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const password =
  process.env.E2E_TENANT_B_SETUP_PASSWORD?.trim() ||
  randomBytes(18).toString("base64url");

const { data: listed, error: listError } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 200,
});
if (listError) fail(`listUsers failed: ${listError.message}`);

const existing = listed?.users?.find(
  (u) => u.email?.toLowerCase() === STAGING_TENANT_B_EMAIL.toLowerCase()
);

let userId = existing?.id ?? null;
if (existing) {
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  });
  if (error) fail(`updateUserById failed: ${error.message}`);
  console.log("Updated existing staging Tenant B auth user.");
} else {
  const { data: created, error } = await admin.auth.admin.createUser({
    email: STAGING_TENANT_B_EMAIL,
    password,
    email_confirm: true,
  });
  if (error || !created.user) fail(`createUser failed: ${error?.message ?? "no user"}`);
  userId = created.user.id;
  console.log("Created staging Tenant B auth user.");
}

const { error: profileError } = await admin.from("profiles").upsert(
  {
    id: userId,
    email: STAGING_TENANT_B_EMAIL,
    full_name: "DrFlow Tenant B QA",
  },
  { onConflict: "id" }
);
if (profileError) fail(`profiles upsert failed: ${profileError.message}`);

const { error: memberError } = await admin.from("clinic_members").upsert(
  {
    clinic_id: clinicB,
    user_id: userId,
    role: "clinic_admin",
    is_active: true,
  },
  { onConflict: "clinic_id,user_id" }
);
if (memberError) fail(`clinic_members upsert failed: ${memberError.message}`);

const envPath = resolve(process.cwd(), ".env.local");
const contents = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const lines = contents.split(/\r?\n/).filter((line) => {
  const t = line.trim();
  return t && !/^E2E_TENANT_B_(EMAIL|PASSWORD)=/.test(t);
});
lines.push(`E2E_TENANT_B_EMAIL=${STAGING_TENANT_B_EMAIL}`);
lines.push(`E2E_TENANT_B_PASSWORD=${password}`);
writeFileSync(envPath, `${lines.join("\n")}\n`, "utf8");

console.log(`Configured .env.local with E2E_TENANT_B_EMAIL=${STAGING_TENANT_B_EMAIL}`);
console.log("E2E_TENANT_B_PASSWORD=<redacted — see .env.local>");

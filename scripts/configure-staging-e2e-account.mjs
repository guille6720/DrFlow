#!/usr/bin/env node
/**
 * Provision or refresh a dedicated STAGING E2E clinical account.
 * Writes E2E_EMAIL / E2E_PASSWORD into .env.local (never prints the password).
 *
 * Usage: node scripts/configure-staging-e2e-account.mjs
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { loadEnv } from "./_env.mjs";
import {
  assertLinkedStagingOrExit,
  PRODUCTION_REF,
  readLinkedProjectRef,
} from "./supabase-project-refs.mjs";

const STAGING_E2E_EMAIL = "drflow-release-qa@staging.drflow.invalid";
const STAGING_E2E_CLINIC_ID = "a0000000-0000-4000-8000-000000000001";

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

assertLinkedStagingOrExit();
if (readLinkedProjectRef() !== "gprmsufvhabntbrytwyi") {
  fail("CLI must be linked to staging.");
}

const env = loadEnv({ required: true });
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceKey) fail("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
if (url.includes(PRODUCTION_REF)) fail("Refusing production Supabase URL.");

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const password =
  process.env.E2E_SETUP_PASSWORD?.trim() ||
  randomBytes(18).toString("base64url");

let userId = null;

const { data: listed, error: listError } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 200,
});
if (listError) fail(`listUsers failed: ${listError.message}`);

const existing = listed?.users?.find(
  (u) => u.email?.toLowerCase() === STAGING_E2E_EMAIL.toLowerCase()
);

if (existing) {
  userId = existing.id;
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  });
  if (updateError) fail(`updateUserById failed: ${updateError.message}`);
  console.log("Updated existing staging E2E auth user.");
} else {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: STAGING_E2E_EMAIL,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    fail(`createUser failed: ${createError?.message ?? "no user"}`);
  }
  userId = created.user.id;
  console.log("Created staging E2E auth user.");
}

const { error: profileError } = await admin.from("profiles").upsert(
  {
    id: userId,
    email: STAGING_E2E_EMAIL,
    full_name: "DrFlow Release QA",
  },
  { onConflict: "id" }
);
if (profileError) fail(`profiles upsert failed: ${profileError.message}`);

const { error: memberError } = await admin.from("clinic_members").upsert(
  {
    clinic_id: STAGING_E2E_CLINIC_ID,
    user_id: userId,
    role: "clinic_admin",
    is_active: true,
  },
  { onConflict: "clinic_id,user_id" }
);
if (memberError) fail(`clinic_members upsert failed: ${memberError.message}`);

const envPath = resolve(process.cwd(), ".env.local");
const contents = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

/** Line-safe upsert; repairs credentials accidentally appended to the previous line. */
function upsertE2eCredentials(raw, email, password) {
  const lines = raw.split(/\r?\n/);
  const out = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) {
      out.push(line);
      continue;
    }
    if (/^E2E_EMAIL=/.test(trimmed) || /^E2E_PASSWORD=/.test(trimmed)) continue;

    const corruptIdx = line.search(/\bE2E_(EMAIL|PASSWORD)=/);
    if (corruptIdx > 0) {
      out.push(line.slice(0, corruptIdx).trimEnd());
      continue;
    }

    out.push(line);
  }

  out.push(`E2E_EMAIL=${email}`);
  out.push(`E2E_PASSWORD=${password}`);
  return `${out.join("\n")}\n`;
}

writeFileSync(envPath, upsertE2eCredentials(contents, STAGING_E2E_EMAIL, password), "utf8");

console.log("Configured .env.local with E2E_EMAIL (password stored locally, not printed).");
console.log(`E2E_EMAIL=${STAGING_E2E_EMAIL}`);
console.log("E2E_PASSWORD=<redacted — see .env.local>");
process.exit(0);

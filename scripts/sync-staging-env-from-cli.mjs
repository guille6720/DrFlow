#!/usr/bin/env node
/**
 * Sync staging Supabase URL + keys from linked CLI into .env.local.
 * Never prints secret values to stdout.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  assertLinkedStagingOrExit,
  PRODUCTION_REF,
  STAGING_REF,
} from "./supabase-project-refs.mjs";

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

assertLinkedStagingOrExit();

const result = spawnSync(
  "npx",
  ["supabase", "projects", "api-keys", "--project-ref", STAGING_REF, "-o", "json"],
  { encoding: "utf8", shell: true }
);

const _cliOutput = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
if ((result.status ?? 1) !== 0) {
  fail(`Could not fetch staging API keys via CLI (exit ${result.status ?? "?"}).`);
}

let parsed;
try {
  parsed = JSON.parse(result.stdout ?? "[]");
} catch {
  fail("Unexpected api-keys JSON from Supabase CLI.");
}

const anon =
  parsed.find((row) => row.name === "anon" || row.name === "anon_key")?.api_key ??
  parsed.find((row) => row.name === "publishable")?.api_key;
const service = parsed.find((row) => row.name === "service_role")?.api_key;

if (!anon || !service) fail("Missing anon or service_role key in CLI response.");

const url = `https://${STAGING_REF}.supabase.co`;
if (url.includes(PRODUCTION_REF)) fail("Refusing production URL.");

const envPath = resolve(process.cwd(), ".env.local");
let contents = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

function upsert(key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  contents = re.test(contents) ? contents.replace(re, line) : `${contents.trimEnd()}\n${line}\n`;
}

upsert("NEXT_PUBLIC_SUPABASE_URL", url);
upsert("NEXT_PUBLIC_SUPABASE_ANON_KEY", anon);
upsert("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", anon);
upsert("SUPABASE_SERVICE_ROLE_KEY", service);
writeFileSync(envPath, contents.startsWith("\n") ? contents.trimStart() : contents, "utf8");

console.log("Synced staging Supabase URL and keys into .env.local (values redacted).");

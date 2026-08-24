#!/usr/bin/env node
/**
 * Print linked Supabase project and abort if it is not DrFlow-Staging.
 * Usage: npm run supabase:preflight:staging
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

import {
  assertLinkedStagingOrExit,
  linkedProjectRefPath,
  PRODUCTION_NAME,
  PRODUCTION_REF,
  STAGING_NAME,
  STAGING_REF,
} from "./supabase-project-refs.mjs";

const linked = assertLinkedStagingOrExit();
const configPath = resolve(process.cwd(), "supabase/config.toml");
let configProjectId = "(missing)";
if (existsSync(configPath)) {
  const m = readFileSync(configPath, "utf8").match(/^\s*project_id\s*=\s*"([^"]+)"/m);
  if (m) configProjectId = m[1];
}

console.log("Supabase preflight — staging gate");
console.log("=================================");
console.log(`CLI linked ref:     ${linked ?? "(none — will require --project-ref)"}`);
console.log(`Expected staging:   ${STAGING_REF} (${STAGING_NAME})`);
console.log(`Forbidden prod:     ${PRODUCTION_REF} (${PRODUCTION_NAME})`);
console.log(`config.toml id:     ${configProjectId}`);
console.log(`link file:          ${linkedProjectRefPath()}`);
console.log("");

if (configProjectId === PRODUCTION_REF) {
  console.log(
    "NOTE: config.toml still lists the production project_id (auth Site URL tooling)."
  );
  console.log(
    "That is intentional and must NOT be used as the target for db push."
  );
  console.log(`Always pass --project-ref ${STAGING_REF} for staging migrations.`);
  console.log("");
}

if (linked === STAGING_REF || linked === null) {
  console.log("OK: staging gate passed (linked ref is staging or unset).");
  process.exit(0);
}

process.exit(1);

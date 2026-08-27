/**
 * Load medication catalogs (national + PAMI) into PRODUCTION for Tratamientos search.
 *
 * Prerequisites:
 *   - Migrations 042 + 107 applied on production (pami_vademecum + national_medications)
 *   - data/anmat/medicamentos.json (run: npm run import:national-medications:download)
 *   - data/pami/gavade_20230829_102140.xlsx
 *
 * PowerShell:
 *   cd c:\dev\DrFlow-staging
 *   $env:ALLOW_PRODUCTION_DB="1"
 *   $env:CONFIRM_PRODUCTION_DB="nipqdarduknydqptqzup"
 *   $env:NEXT_PUBLIC_SUPABASE_URL="https://nipqdarduknydqptqzup.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="TU_SERVICE_ROLE_KEY_DE_PRODUCCION"
 *   node scripts/apply-medications-production.mjs
 *
 * Only national:
 *   node scripts/apply-medications-production.mjs --national-only
 *
 * Only PAMI:
 *   node scripts/apply-medications-production.mjs --pami-only
 *
 * Verify only:
 *   node scripts/apply-medications-production.mjs --verify-only
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { PRODUCTION_REF } from "./supabase-project-refs.mjs";

const DRY_RUN = process.argv.includes("--dry-run");
const VERIFY_ONLY = process.argv.includes("--verify-only");
const NATIONAL_ONLY = process.argv.includes("--national-only");
const PAMI_ONLY = process.argv.includes("--pami-only");

function fail(msg) {
  console.error(`\nERROR: ${msg}\n`);
  process.exit(1);
}

function assertProductionEnv() {
  if (process.env.ALLOW_PRODUCTION_DB !== "1") {
    fail("Set ALLOW_PRODUCTION_DB=1 explicitly.");
  }
  if (process.env.CONFIRM_PRODUCTION_DB !== PRODUCTION_REF) {
    fail(`Set CONFIRM_PRODUCTION_DB=${PRODUCTION_REF}.`);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    fail("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for production.");
  }
  if (!url.includes(PRODUCTION_REF)) {
    fail(`NEXT_PUBLIC_SUPABASE_URL must target production ref ${PRODUCTION_REF}.`);
  }
  return { url, key };
}

async function verify(url, key) {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const checks = {};

  // Probe auth/key first — wrong key makes every table look "missing".
  const keyProbe = await supabase.from("clinics").select("id", { count: "exact", head: true }).limit(1);
  checks.api_key_ok = !keyProbe.error;
  checks.api_key_error = keyProbe.error?.message ?? null;
  if (keyProbe.error && /invalid api key|jwt|unauthorized/i.test(keyProbe.error.message)) {
    console.log(JSON.stringify({ target: PRODUCTION_REF, ...checks }, null, 2));
    fail(
      "SUPABASE_SERVICE_ROLE_KEY inválida para este proyecto.\n" +
        "Usá la key service_role de PRODUCCIÓN (nipqdarduknydqptqzup):\n" +
        "  Supabase Dashboard → Project Settings → API → service_role (secret)\n" +
        "NO uses la publishable/anon key ni la service_role de staging."
    );
  }

  const national = await supabase
    .from("national_medications")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  checks.national_medications_table = !national.error;
  checks.national_medications_count = national.count ?? 0;
  checks.national_error = national.error?.message ?? null;

  const pami = await supabase
    .from("pami_vademecum")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  checks.pami_vademecum_table = !pami.error;
  checks.pami_vademecum_count = pami.count ?? 0;
  checks.pami_error = pami.error?.message ?? null;

  const { data: rpcProbe, error: rpcError } = await supabase.rpc("search_medication_catalog", {
    p_query: "ibuprofeno",
    p_limit: 3,
  });
  checks.search_medication_catalog_ok = !rpcError;
  checks.search_sample_hits = Array.isArray(rpcProbe) ? rpcProbe.length : 0;
  checks.search_error = rpcError?.message ?? null;

  console.log(JSON.stringify({ target: PRODUCTION_REF, ...checks }, null, 2));
  return checks;
}

function runImport(scriptArgs) {
  const result = spawnSync("node", scriptArgs, {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  if (result.status !== 0) {
    fail(`Import failed: ${scriptArgs.join(" ")}`);
  }
}

if (DRY_RUN) {
  console.log(
    JSON.stringify(
      {
        mode: "dry-run",
        target: PRODUCTION_REF,
        national_json: existsSync(resolve("data/anmat/medicamentos.json")),
        pami_xlsx: existsSync(resolve("data/pami/gavade_20230829_102140.xlsx")),
        flags: { NATIONAL_ONLY, PAMI_ONLY, VERIFY_ONLY },
      },
      null,
      2
    )
  );
  process.exit(0);
}

const { url, key } = assertProductionEnv();
process.env.NEXT_PUBLIC_SUPABASE_URL = url;
process.env.SUPABASE_SERVICE_ROLE_KEY = key;

if (VERIFY_ONLY) {
  const checks = await verify(url, key);
  const ok =
    checks.national_medications_count >= 1000 &&
    checks.pami_vademecum_count >= 1000 &&
    checks.search_medication_catalog_ok;
  process.exit(ok ? 0 : 1);
}

const before = await verify(url, key);
if (!before.national_medications_table && !PAMI_ONLY) {
  fail(
    "Tabla national_medications no existe en producción. Aplicá migración 107_national_medication_catalog.sql primero."
  );
}
if (!before.pami_vademecum_table && !NATIONAL_ONLY) {
  fail("Tabla pami_vademecum no existe en producción. Aplicá migración 042_pami_vademecum.sql primero.");
}

if (!PAMI_ONLY) {
  const jsonPath = resolve("data/anmat/medicamentos.json");
  if (!existsSync(jsonPath)) {
    console.log("Descargando catálogo nacional…");
    runImport(["scripts/import-national-medications.mjs", "--download"]);
  }
  console.log("\n=== Importando national_medications (producción) ===\n");
  runImport([
    "scripts/import-national-medications.mjs",
    "--file",
    "data/anmat/medicamentos.json",
    "--apply-api",
  ]);
}

if (!NATIONAL_ONLY) {
  const xlsx = resolve("data/pami/gavade_20230829_102140.xlsx");
  if (!existsSync(xlsx)) {
    fail(`Missing ${xlsx}`);
  }
  console.log("\n=== Importando pami_vademecum (producción) ===\n");
  runImport(["scripts/import-pami-vademecum.mjs", "--apply-api"]);
}

console.log("\n=== Verificación final ===\n");
const after = await verify(url, key);
if (!after.search_medication_catalog_ok) {
  fail(`RPC search_medication_catalog falló: ${after.search_error}`);
}
console.log("\nPRODUCTION_MEDICATIONS_OK");

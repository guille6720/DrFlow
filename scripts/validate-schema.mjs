#!/usr/bin/env node
/**
 * Validates that SQL migrations satisfy schema expectations from application code.
 *
 * Usage:
 *   node scripts/validate-schema.mjs           # static (migrations only)
 *   node scripts/validate-schema.mjs --live      # + Supabase REST probes
 */
import {readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { loadEnv } from "./_env.mjs";
import {
  EXPECTED_COLUMNS,
  EXPECTED_INDEXES,
  EXPECTED_RPCS,
  EXPECTED_TABLES,
  MIGRATION_SEQUENCE,
} from "./lib/schema-expectations.mjs";

const live = process.argv.includes("--live");
const migrationsDir = resolve(process.cwd(), "supabase/migrations");

function loadMigrationSql() {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  return { files, sql: files.map((f) => readFileSync(join(migrationsDir, f), "utf8")).join("\n") };
}

function checkMigrationOrder(files) {
  const issues = [];
  const expectedSet = new Set(MIGRATION_SEQUENCE);
  for (const f of files) {
    if (!expectedSet.has(f) && !f.match(/^\d{3}[a-z]?_/)) {
      issues.push(`Unexpected migration filename: ${f}`);
    }
  }
  for (let i = 1; i < MIGRATION_SEQUENCE.length; i++) {
    const prev = MIGRATION_SEQUENCE[i - 1];
    const curr = MIGRATION_SEQUENCE[i];
    if (files.includes(prev) && files.includes(curr) && files.indexOf(prev) > files.indexOf(curr)) {
      issues.push(`Out of order: ${curr} should run after ${prev}`);
    }
  }
  const missing = MIGRATION_SEQUENCE.filter((f) => !files.includes(f));
  if (missing.length) {
    issues.push(`Missing migration files: ${missing.join(", ")}`);
  }
  return issues;
}

function checkTables(sql) {
  const missing = [];
  for (const table of EXPECTED_TABLES) {
    const create = new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${table}\\b`, "i");
    const alter = new RegExp(`ALTER\\s+TABLE\\s+${table}\\b`, "i");
    if (!create.test(sql) && !alter.test(sql)) {
      missing.push(table);
    }
  }
  return missing;
}

function checkColumns(sql) {
  const missing = [];
  for (const [table, columns] of Object.entries(EXPECTED_COLUMNS)) {
    for (const col of columns) {
      const patterns = [
        new RegExp(`ALTER\\s+TABLE\\s+${table}[\\s\\S]*?ADD\\s+COLUMN\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${col}\\b`, "i"),
        new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${table}[\\s\\S]*?\\b${col}\\b`, "i"),
      ];
      if (!patterns.some((p) => p.test(sql))) {
        missing.push(`${table}.${col}`);
      }
    }
  }
  return missing;
}

function checkRpcs(sql) {
  const missing = [];
  for (const rpc of EXPECTED_RPCS) {
    const fn = new RegExp(`(?:CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+(?:public\\.)?${rpc}\\b|FUNCTION\\s+${rpc}\\()`, "i");
    if (!fn.test(sql)) {
      missing.push(rpc);
    }
  }
  return missing;
}

function checkIndexes(sql) {
  const missing = [];
  for (const idx of EXPECTED_INDEXES) {
    if (!sql.includes(idx)) {
      missing.push(idx);
    }
  }
  return missing;
}

function checkRls(sql) {
  const missing = [];
  for (const table of EXPECTED_TABLES) {
    const enable = new RegExp(`ALTER\\s+TABLE\\s+${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, "i");
    const policy = new RegExp(`CREATE\\s+POLICY\\s+\\w+\\s+ON\\s+${table}\\s+`, "i");
    if (!enable.test(sql) && !policy.test(sql)) {
      missing.push(table);
    }
  }
  return missing;
}

function checkDuplicatePolicies(sql) {
  const names = [...sql.matchAll(/CREATE\s+POLICY\s+(\w+)\s+ON/gi)].map((m) => m[1]);
  const seen = new Map();
  const dupes = [];
  for (const name of names) {
    seen.set(name, (seen.get(name) ?? 0) + 1);
  }
  for (const [name, count] of seen) {
    if (count > 1) dupes.push(`${name} (${count}x CREATE POLICY — expect DROP POLICY IF EXISTS before recreate)`);
  }
  return dupes;
}

async function checkLiveDb() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  const anon =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const apiKey = service ?? anon;
  const auth = service ? `Bearer ${service}` : `Bearer ${anon}`;

  if (!url || !apiKey || url.includes("placeholder")) {
    return ["Live check skipped: no valid Supabase credentials in .env.local"];
  }

  const issues = [];
  const headers = { apikey: apiKey, Authorization: auth };

  const probes = [
    { table: "clinic_members", select: "professional_id", migration: "057" },
    { table: "patients", select: "insurance_plan", migration: "041" },
    { table: "clinics", select: "accepted_coverages,trial_ends_at", migration: "030/032" },
    { table: "patient_clinical_profiles", select: "patient_id,notes", migration: "047" },
    { table: "audit_logs", select: "module,what,patient_id", migration: "055" },
    { table: "clinic_feature_flags", select: "flag_id", migration: "050" },
    { table: "clinic_jobs", select: "job_type", migration: "051" },
    { table: "clinic_observability_events", select: "category", migration: "052" },
  ];

  for (const { table, select, migration } of probes) {
    const res = await fetch(`${url}/rest/v1/${table}?select=${select}&limit=1`, { headers });
    const body = await res.text();
    if (res.status === 404 || res.status === 406 || (res.status === 400 && body.includes("does not exist"))) {
      issues.push(`Live: table '${table}' missing — migration ${migration}`);
    } else if (res.status === 400) {
      const col = select.split(",")[0];
      if (body.includes(col)) {
        issues.push(`Live: column '${table}.${col}' missing — migration ${migration}`);
      }
    }
  }

  const rpcRes = await fetch(`${url}/rest/v1/rpc/get_public_booking_occupancy`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_slug: "__schema_check__",
      p_professional_id: "00000000-0000-0000-0000-000000000001",
    }),
  });
  const rpcBody = await rpcRes.text();
  if (rpcRes.status === 404 || rpcBody.includes("PGRST202")) {
    issues.push("Live: RPC get_public_booking_occupancy missing — migration 045");
  }

  const memberRes = await fetch(
    `${url}/rest/v1/clinic_members?select=professional_id&limit=1`,
    { headers }
  );
  if (memberRes.status === 400) {
    const body = await memberRes.text();
    if (body.includes("professional_id")) {
      issues.push("Live: clinic_members.professional_id missing — apply migration 057");
    }
  }

  return issues;
}

async function main() {
  console.log("\n🗄 DrFlow — Schema validation (code ↔ migrations)\n");

  const { files, sql } = loadMigrationSql();
  const results = {
    order: checkMigrationOrder(files),
    tables: checkTables(sql),
    columns: checkColumns(sql),
    rpcs: checkRpcs(sql),
    indexes: checkIndexes(sql),
    rls: checkRls(sql),
    duplicatePolicies: checkDuplicatePolicies(sql),
    live: live ? await checkLiveDb() : [],
  };

  let failed = false;

  for (const [key, items] of Object.entries(results)) {
    if (key === "duplicatePolicies" && items.length) {
      console.log(`⚠ Duplicate policy names (informational):`);
      items.forEach((i) => console.log(`   ${i}`));
      continue;
    }
    if (items.length === 0) {
      console.log(`✓ ${key}`);
    } else {
      failed = true;
      console.log(`❌ ${key}:`);
      items.forEach((i) => console.log(`   ${i}`));
    }
  }

  console.log(`\n   ${files.length} migration files scanned`);
  console.log(
    failed
      ? "\n❌ Schema validation failed\n"
      : "\n✅ Schema matches code expectations\n"
  );
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});

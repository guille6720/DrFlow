#!/usr/bin/env node
/**
 * Phase 7B — mint authenticated session pool for clinical write k6 (STAGING ONLY).
 * Writes e2e/.phase7b-session-pool.json (gitignored). NEVER prints cookie values.
 *
 * Usage:
 *   node scripts/phase7b-mint-session-pool.mjs
 *
 * Requires: E2E_EMAIL / E2E_PASSWORD, coverage/load/clinical-write-fixtures.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { createServerClient } from "@supabase/ssr";

import { loadEnv } from "./_env.mjs";
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

const env = loadEnv({ required: true });
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anon = (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const email = (env.E2E_EMAIL || "").trim();
const password = (env.E2E_PASSWORD || "").trim();
if (!url || !anon) fail("Missing Supabase URL/anon key.");
if (url.includes(PRODUCTION_REF)) fail("Refusing production Supabase URL.");
if (!email || !password) fail("E2E_EMAIL / E2E_PASSWORD required.");

const fixturesPath = resolve(process.cwd(), "coverage/load/clinical-write-fixtures.json");
if (!existsSync(fixturesPath)) {
  fail("Missing clinical-write-fixtures.json — run phase7b-seed-write-fixtures.mjs first.");
}
const fixtures = JSON.parse(readFileSync(fixturesPath, "utf8"));
if (!Array.isArray(fixtures.clinics) || fixtures.clinics.length === 0) {
  fail("Fixtures contain no clinics.");
}

const jar = [];
const client = createServerClient(url, anon, {
  cookies: {
    getAll() {
      return jar.map(({ name, value }) => ({ name, value }));
    },
    setAll(cookiesToSet) {
      for (const c of cookiesToSet) {
        const idx = jar.findIndex((x) => x.name === c.name);
        if (idx >= 0) jar[idx] = { name: c.name, value: c.value };
        else jar.push({ name: c.name, value: c.value });
      }
    },
  },
});

const { data, error } = await client.auth.signInWithPassword({ email, password });
if (error || !data.session) fail(`signIn failed: ${error?.message ?? "no session"}`);

const authCookieHeader = jar.map((c) => `${c.name}=${c.value}`).join("; ");
if (!authCookieHeader || authCookieHeader.length < 20) {
  fail("SSR cookie jar empty after login — cannot mint session pool.");
}

const sessions = fixtures.clinics.map((clinic) => {
  const clinicRecords = (fixtures.records || []).filter((r) => r.clinic_id === clinic.id);
  const clinicPatients = (fixtures.patients || []).filter((p) => p.clinic_id === clinic.id);
  const clinicAppts = (fixtures.appointments || []).filter((a) => a.clinic_id === clinic.id);
  const cookie = `${authCookieHeader}; drflow_clinic_id=${clinic.id}`;
  return {
    clinic_id: clinic.id,
    clinic_name: clinic.name,
    user_id: fixtures.actorUserId,
    records: clinicRecords.map((r) => ({
      id: r.id,
      patient_id: r.patient_id,
      professional_id: r.professional_id,
    })),
    record_ids: clinicRecords.map((r) => r.id),
    patient_ids: clinicPatients.map((p) => p.id),
    professional_ids: [
      ...new Set(clinicRecords.map((r) => r.professional_id).filter(Boolean)),
    ],
    appointment_ids: clinicAppts.map((a) => a.id),
    // cookie field present for k6 — never log
    cookie,
  };
});

const pool = {
  generatedAt: new Date().toISOString(),
  stagingRef: STAGING_REF,
  sessionCount: sessions.length,
  cookiePresent: true,
  cookieLengthHint: authCookieHeader.length,
  sessions: sessions.map((s) => ({
    clinic_id: s.clinic_id,
    clinic_name: s.clinic_name,
    user_id: s.user_id,
    records: s.records,
    record_ids: s.record_ids,
    patient_ids: s.patient_ids,
    professional_ids: s.professional_ids,
    appointment_ids: s.appointment_ids,
    cookie: s.cookie,
  })),
};

const outPath = resolve(process.cwd(), "e2e/.phase7b-session-pool.json");
writeFileSync(outPath, JSON.stringify(pool, null, 2), "utf8");

mkdirSync(resolve(process.cwd(), "coverage/load"), { recursive: true });
writeFileSync(
  resolve(process.cwd(), "coverage/load/phase7b-session-pool-meta.json"),
  JSON.stringify(
    {
      generatedAt: pool.generatedAt,
      sessionCount: pool.sessionCount,
      clinics: sessions.map((s) => ({
        clinic_id: s.clinic_id,
        clinic_name: s.clinic_name,
        records: s.record_ids.length,
        patients: s.patient_ids.length,
        appointments: s.appointment_ids.length,
      })),
      poolPath: "e2e/.phase7b-session-pool.json",
      note: "Cookie values omitted from this meta file.",
    },
    null,
    2
  ),
  "utf8"
);

console.log("Phase 7B session pool minted.");
console.log(`  sessions: ${sessions.length}`);
console.log(`  pool:     e2e/.phase7b-session-pool.json (gitignored)`);
console.log(`  meta:     coverage/load/phase7b-session-pool-meta.json`);
console.log("  cookie values were NOT printed.");

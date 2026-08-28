#!/usr/bin/env node
/**
 * Phase 7 — pre-flight gate before any serious k6 load run.
 * Fails closed when distributed Redis rate limiting is unavailable.
 *
 * Usage:
 *   node scripts/phase7-load-preflight.mjs
 *   node scripts/phase7-load-preflight.mjs --base-url=https://...
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { loadEnv, readArg } from "./_env.mjs";
import { PRODUCTION_REF, STAGING_REF } from "./supabase-project-refs.mjs";

const OUT = resolve(process.cwd(), "coverage/load/phase7-preflight.json");
const env = loadEnv({ required: false });

function has(name) {
  const v = process.env[name] ?? env[name];
  return Boolean(v && String(v).trim() && !/\[SENSITIVE\]|placeholder/i.test(String(v)));
}

function redisConfigured() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    env.UPSTASH_REDIS_REST_URL ||
    process.env.RATE_LIMIT_REDIS_REST_URL ||
    env.RATE_LIMIT_REDIS_REST_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.RATE_LIMIT_REDIS_REST_TOKEN ||
    env.RATE_LIMIT_REDIS_REST_TOKEN;
  return Boolean(
    url &&
      token &&
      String(url).startsWith("http") &&
      !/\[SENSITIVE\]|placeholder/i.test(String(url))
  );
}

async function probeRedis() {
  if (!redisConfigured()) {
    return { ok: false, backend: "memory", reason: "UPSTASH/RATE_LIMIT Redis env missing" };
  }
  const url = (
    process.env.UPSTASH_REDIS_REST_URL ||
    env.UPSTASH_REDIS_REST_URL ||
    process.env.RATE_LIMIT_REDIS_REST_URL ||
    env.RATE_LIMIT_REDIS_REST_URL
  )
    .trim()
    .replace(/\/$/, "");
  const token = (
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.RATE_LIMIT_REDIS_REST_TOKEN ||
    env.RATE_LIMIT_REDIS_REST_TOKEN
  ).trim();
  const key = `drflow:rl:preflight:${Date.now()}`;
  try {
    const res = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      return { ok: false, backend: "memory", reason: `Redis HTTP ${res.status}` };
    }
    return { ok: true, backend: "redis", reason: "INCR succeeded" };
  } catch (err) {
    return {
      ok: false,
      backend: "memory",
      reason: String(err.message ?? err).slice(0, 200),
    };
  }
}

function findK6() {
  const local = resolve(process.cwd(), "tools/k6.exe");
  if (existsSync(local)) {
    const r = spawnSync(local, ["version"], { encoding: "utf8" });
    return { path: local, version: (r.stdout || r.stderr || "").trim(), ok: r.status === 0 };
  }
  const r = spawnSync("k6", ["version"], { encoding: "utf8", shell: true });
  return {
    path: "k6",
    version: (r.stdout || r.stderr || "").trim(),
    ok: r.status === 0,
  };
}

function resolveBaseUrl() {
  return (
    readArg("--base-url") ||
    process.env.K6_BASE_URL ||
    process.env.HEALTH_CHECK_URL ||
    env.HEALTH_CHECK_URL ||
    env.NEXT_PUBLIC_SITE_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
}

async function main() {
  const redis = await probeRedis();
  const k6 = findK6();
  const baseUrl = resolveBaseUrl();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isStagingDb = supabaseUrl.includes(STAGING_REF);
  const isProdDb = supabaseUrl.includes(PRODUCTION_REF);

  let health = { ok: false, detail: "not probed" };
  let version = null;
  if (baseUrl.startsWith("http")) {
    try {
      const ready = await fetch(`${baseUrl}/api/health/ready`, {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      const body = await ready.json().catch(() => ({}));
      health = {
        ok: ready.ok && body.ok === true,
        status: ready.status,
        detail: body.ok === true ? "ready" : JSON.stringify(body).slice(0, 200),
      };
      const verRes = await fetch(`${baseUrl}/api/version`, {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      version = await verRes.json().catch(() => null);
    } catch (err) {
      health = { ok: false, detail: String(err.message ?? err).slice(0, 200) };
    }
  } else {
    health = { ok: false, detail: "BASE_URL / NEXT_PUBLIC_SITE_URL missing or invalid" };
  }

  const sessionConfigured = has("K6_SESSION_COOKIE");
  const report = {
    generatedAt: new Date().toISOString(),
    distributedRateLimitActive: redis.ok === true,
    redis,
    k6,
    baseUrlHost: baseUrl.startsWith("http") ? new URL(baseUrl).host : null,
    stagingSupabase: isStagingDb,
    productionSupabaseBlocked: isProdDb,
    health,
    version: version
      ? { version: version.version, buildId: version.buildId ?? version.build_id ?? null }
      : null,
    sessionCookieConfigured: sessionConfigured,
    sentryConfigured: has("SENTRY_DSN") || has("NEXT_PUBLIC_SENTRY_DSN"),
    blockers: [],
  };

  if (!redis.ok) {
    report.blockers.push(
      "MANUAL INFRA: configure UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN on staging (memory fallback not accepted for Phase 7 load)"
    );
  }
  if (!k6.ok) report.blockers.push("Install k6 (tools/k6.exe or PATH)");
  if (isProdDb) report.blockers.push("Refusing production Supabase project");
  if (!health.ok) report.blockers.push(`Health ready failed: ${health.detail}`);
  if (!sessionConfigured) {
    report.blockers.push("Set K6_SESSION_COOKIE for authenticated application capacity tests");
  }

  report.pass = report.blockers.length === 0;

  mkdirSync(resolve(process.cwd(), "coverage/load"), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log("\n🚦 Phase 7 — Load pre-flight\n");
  console.log(`   Redis RL active: ${report.distributedRateLimitActive}`);
  console.log(`   k6:              ${k6.ok ? k6.version : "MISSING"}`);
  console.log(`   Target host:     ${report.baseUrlHost ?? "(none)"}`);
  console.log(`   Staging DB:      ${isStagingDb}`);
  console.log(`   Health ready:    ${health.ok}`);
  console.log(`   Session cookie:  ${sessionConfigured}`);
  if (report.blockers.length) {
    console.log("\n   ⛔ BLOCKERS:");
    for (const b of report.blockers) console.log(`   • ${b}`);
  }
  console.log(`\n→ ${OUT}\n`);
  process.exit(report.pass ? 0 : 2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

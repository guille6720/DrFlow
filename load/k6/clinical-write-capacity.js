/**
 * Phase 7B — clinical WRITE capacity (authenticated, staging/preview only).
 *
 * REQUIRED:
 *   BASE_URL or K6_BASE_URL
 *   K6_SESSION_POOL_FILE (preferred) or K6_SESSION_COOKIE
 *   STAGE=10|25|50|100|250|500|750|1000
 *
 * Never run against production.
 */
import { sleep } from "k6";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.2/index.js";

import { loadWritePoolInit, getWritePool, pickSession } from "./lib/write-fixtures.js";
import { writeThresholds } from "./lib/write-metrics.js";
import { runWriteIteration } from "./lib/write-scenarios.js";

const STAGE = Number(__ENV.STAGE || "10");
const POOL = loadWritePoolInit();

function holdFor(vus) {
  if (vus <= 10) return "1m";
  if (vus <= 25) return "2m";
  if (vus <= 50) return "3m";
  if (vus <= 100) return "5m";
  if (vus <= 500) return "5m";
  if (vus <= 750) return "5m";
  return "8m";
}

export const options = {
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
  stages: [
    { duration: "20s", target: Math.max(1, Math.floor(STAGE / 2)) },
    { duration: holdFor(STAGE), target: STAGE },
    { duration: "20s", target: 0 },
  ],
  thresholds: writeThresholds(),
};

export function setup() {
  const base = (__ENV.BASE_URL || __ENV.K6_BASE_URL || "").toLowerCase();
  if (!base) throw new Error("BASE_URL / K6_BASE_URL required");
  if (base.includes("drflow.opusorg.com") && !base.includes("staging") && !base.includes("preview")) {
    throw new Error("Refusing production URL");
  }
  const pool = getWritePool();
  if (!pool.sessions?.length) throw new Error("Empty session pool");
  for (const s of pool.sessions) {
    if (!s.cookie) throw new Error("Session missing cookie — abort");
    if (!s.record_ids?.length && !s.records?.length) {
      throw new Error(`Clinic ${s.clinic_id} has no records`);
    }
  }
  return {
    startedAt: new Date().toISOString(),
    stage: STAGE,
    clinics: pool.sessions.length,
    records: pool.sessions.reduce(
      (n, s) => n + (s.records?.length || s.record_ids?.length || 0),
      0
    ),
  };
}

export default function clinicalWriteCapacity() {
  const session = pickSession(POOL, __VU);
  runWriteIteration(session);
}

export function teardown(data) {
  sleep(0.1);
  console.log(JSON.stringify({ event: "teardown", ...data, finishedAt: new Date().toISOString() }));
}

export function handleSummary(data) {
  const out = __ENV.K6_SUMMARY_PATH || `coverage/load/write-${STAGE}vu.json`;
  return {
    [out]: JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: " ", enableColors: false }),
  };
}

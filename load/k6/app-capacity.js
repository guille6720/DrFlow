/**
 * Phase 7 — authenticated application capacity test.
 *
 * REQUIRED (or preflight fails / script aborts):
 *   BASE_URL              staging/preview URL only — never production
 *   K6_SESSION_COOKIE     pre-authenticated synthetic user cookie
 *   UPSTASH Redis on target (verified by phase7-load-preflight.mjs)
 *
 * STAGE=10|25|50|100|250|500|750|1000
 */
import { sleep } from "k6";
import { baseThresholds } from "./lib/metrics.js";
import { runAppIteration } from "./lib/scenarios.js";
import { sessionHeaders } from "./lib/auth.js";

const STAGE = Number(__ENV.STAGE || "10");

function stagesFor(vus) {
  if (vus <= 50) {
    return [
      { duration: "20s", target: Math.max(1, Math.floor(vus / 2)) },
      { duration: "1m", target: vus },
      { duration: "20s", target: 0 },
    ];
  }
  // Progressive hold times for higher stages
  const hold = vus >= 1000 ? "8m" : vus >= 500 ? "5m" : "3m";
  return [
    { duration: "1m", target: Math.floor(vus / 2) },
    { duration: hold, target: vus },
    { duration: "1m", target: 0 },
  ];
}

export const options = {
  stages: stagesFor(STAGE),
  thresholds: baseThresholds(),
};

export function setup() {
  if (!sessionHeaders()) {
    throw new Error("K6_SESSION_COOKIE required — aborting anonymous load");
  }
  const base = (__ENV.BASE_URL || "").toLowerCase();
  if (base.includes("drflow.opusorg.com") && !base.includes("staging") && !base.includes("preview")) {
    throw new Error("Refusing suspected production URL — set BASE_URL to staging/preview only");
  }
  return { startedAt: new Date().toISOString(), stage: STAGE };
}

export default function appCapacityScenario() {
  runAppIteration();
}

export function teardown(data) {
  sleep(0.1);
  console.log(JSON.stringify({ event: "teardown", ...data, finishedAt: new Date().toISOString() }));
}

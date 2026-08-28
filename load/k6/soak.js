/**
 * Phase 7 — soak: 100–250 VUs for 30–60 minutes (default 100 / 30m).
 * Env: SOAK_VUS=100|250  SOAK_DURATION=30m|60m
 */
import { baseThresholds } from "./lib/metrics.js";
import { runAppIteration } from "./lib/scenarios.js";
import { sessionHeaders } from "./lib/auth.js";

const VUS = Number(__ENV.SOAK_VUS || "100");
const DURATION = __ENV.SOAK_DURATION || "30m";

export const options = {
  stages: [
    { duration: "2m", target: VUS },
    { duration: DURATION, target: VUS },
    { duration: "2m", target: 0 },
  ],
  thresholds: baseThresholds(),
};

export function setup() {
  if (!sessionHeaders()) throw new Error("K6_SESSION_COOKIE required");
}

export default function soakScenario() {
  runAppIteration();
}

/**
 * Phase 7 — spike: 100 → 1000 → 100 (authenticated app only).
 */
import { baseThresholds } from "./lib/metrics.js";
import { runAppIteration } from "./lib/scenarios.js";
import { sessionHeaders } from "./lib/auth.js";

export const options = {
  stages: [
    { duration: "1m", target: 100 },
    { duration: "30s", target: 1000 },
    { duration: "2m", target: 1000 },
    { duration: "1m", target: 100 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    ...baseThresholds(),
    // Spike allows temporary degradation but must recover (errors still bounded)
    http_req_failed: ["rate<0.05"],
    errors: ["rate<0.05"],
  },
};

export function setup() {
  if (!sessionHeaders()) throw new Error("K6_SESSION_COOKIE required");
}

export default function spikeScenario() {
  runAppIteration();
}

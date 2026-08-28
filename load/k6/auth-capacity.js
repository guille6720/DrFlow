/**
 * Phase 7 — AUTH capacity only (separate from application capacity).
 * Conservative VU progression — respects provider rate limits.
 *
 * Env: BASE_URL, K6_AUTH_EMAIL, K6_AUTH_PASSWORD
 * STAGE default 5 (never jump to 1000 for auth).
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { classify, errorRate, opDuration, baseThresholds } from "./lib/metrics.js";
import { baseUrl } from "./lib/auth.js";

const STAGE = Number(__ENV.STAGE || "5");

export const options = {
  stages: [
    { duration: "15s", target: Math.max(1, Math.floor(STAGE / 2)) },
    { duration: "45s", target: STAGE },
    { duration: "15s", target: 0 },
  ],
  thresholds: {
    ...baseThresholds(),
    http_req_duration: ["p(95)<2000"],
  },
};

export default function authCapacityScenario() {
  const email = __ENV.K6_AUTH_EMAIL || "";
  const password = __ENV.K6_AUTH_PASSWORD || "";
  if (!email || !password) {
    errorRate.add(1);
    sleep(1);
    return;
  }

  const started = Date.now();
  const res = http.post(
    `${baseUrl()}/api/auth/login`,
    { email, password },
    { tags: { operation: "auth_login" }, timeout: "30s", redirects: 0 }
  );
  opDuration.add(Date.now() - started, { operation: "auth_login" });
  classify(res);
  // Login may 303 redirect on success — treat 303 as success for auth scenario
  const ok = check(res, {
    "auth_login 2xx/303": (r) => (r.status >= 200 && r.status < 400) || r.status === 303,
  });
  if (!ok) errorRate.add(1);
  sleep(2 + Math.random() * 3);
}

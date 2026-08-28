/**
 * Phase 6 — k6 application capacity script (validated structure only).
 *
 * This is NOT the final 1,000-VU run. Use stages 10 / 25 / 50 for pre-load validation.
 *
 * Required env (via k6 -e or secret store — never commit credentials):
 *   BASE_URL                 e.g. https://staging.example.com
 *   K6_SESSION_COOKIE        authenticated session cookie for application test
 *   K6_AUTH_EMAIL            (optional) only for AUTH capacity scenario
 *   K6_AUTH_PASSWORD         (optional) only for AUTH capacity scenario
 *
 * Run examples:
 *   k6 run --env BASE_URL=... --env K6_SESSION_COOKIE=... --env STAGE=10 load/k6/app-capacity.js
 *   k6 run --env BASE_URL=... --env STAGE=25 load/k6/app-capacity.js
 *
 * Scenarios:
 *   MODE=app   (default) — authenticated app routes with session cookie
 *   MODE=auth  — password login capacity (separate from app capacity)
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const MODE = __ENV.MODE || "app";
const STAGE = Number(__ENV.STAGE || "10");
const SESSION_COOKIE = __ENV.K6_SESSION_COOKIE || "";

const http2xx = new Counter("http_2xx");
const http3xx = new Counter("http_3xx");
const http4xx = new Counter("http_4xx");
const http429 = new Counter("http_429");
const http5xx = new Counter("http_5xx");
const httpTimeout = new Counter("http_timeout");
const httpNetwork = new Counter("http_network");
const errorRate = new Rate("errors");
const opDuration = new Trend("op_duration", true);

function stageConfig(vus) {
  return {
    stages: [
      { duration: "30s", target: Math.max(1, Math.floor(vus / 2)) },
      { duration: "1m", target: vus },
      { duration: "30s", target: 0 },
    ],
    thresholds: {
      http_req_failed: ["rate<0.05"],
      http_req_duration: ["p(95)<3000"],
      errors: ["rate<0.05"],
    },
  };
}

export const options = stageConfig(STAGE);

function classify(res) {
  if (res.status === 0) {
    if (/timeout/i.test(res.error || "")) httpTimeout.add(1);
    else httpNetwork.add(1);
    errorRate.add(1);
    return;
  }
  if (res.status >= 200 && res.status < 300) http2xx.add(1);
  else if (res.status >= 300 && res.status < 400) http3xx.add(1);
  else if (res.status === 429) {
    http429.add(1);
    errorRate.add(1);
  } else if (res.status >= 400 && res.status < 500) {
    http4xx.add(1);
    errorRate.add(1);
  } else if (res.status >= 500) {
    http5xx.add(1);
    errorRate.add(1);
  }
}

function taggedGet(path, name) {
  const headers = {};
  if (SESSION_COOKIE) headers.Cookie = SESSION_COOKIE;
  const started = Date.now();
  const res = http.get(`${BASE_URL}${path}`, {
    headers,
    tags: { operation: name },
    timeout: "30s",
  });
  opDuration.add(Date.now() - started, { operation: name });
  classify(res);
  // Failed/fast error responses must not count as "good" latency for thresholds —
  // k6 http_req_duration includes all; we track op_duration separately and
  // only assert success on 2xx/3xx for app routes.
  const ok = check(res, {
    [`${name} status is 2xx/3xx`]: (r) => r.status >= 200 && r.status < 400,
  });
  if (!ok) errorRate.add(1);
  return res;
}

export default function appCapacityScenario() {
  if (MODE === "auth") {
    const email = __ENV.K6_AUTH_EMAIL || "";
    const password = __ENV.K6_AUTH_PASSWORD || "";
    if (!email || !password) {
      errorRate.add(1);
      sleep(1);
      return;
    }
    const started = Date.now();
    const res = http.post(
      `${BASE_URL}/api/auth/login`,
      { email, password },
      { tags: { operation: "auth_login" }, timeout: "30s" }
    );
    opDuration.add(Date.now() - started, { operation: "auth_login" });
    classify(res);
    sleep(1);
    return;
  }

  if (!SESSION_COOKIE) {
    // Preflight: health only when no session — still validates script + observability.
    taggedGet("/api/health/live", "health_live");
    taggedGet("/api/health/ready", "health_ready");
    sleep(0.5);
    return;
  }

  // Distribute across synthetic routes (not a single patient row).
  const paths = [
    ["/dashboard", "dashboard"],
    ["/pacientes", "patients_list"],
    ["/pacientes?seccion=historias", "historias_page1"],
    ["/turnos/agenda", "appointments_agenda"],
    ["/sala-espera", "waiting_room"],
    ["/api/health/ready", "health_ready"],
  ];
  const pick = paths[Math.floor(Math.random() * paths.length)];
  taggedGet(pick[0], pick[1]);
  sleep(0.3 + Math.random() * 0.7);
}

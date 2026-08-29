/**
 * Phase 7B — small contention test (does NOT define capacity).
 * 10–25 VUs hammer a tiny synthetic record set.
 *
 * BASE_URL + K6_SESSION_POOL_FILE required.
 * CONTENTION_VUS=10|25 (default 10)
 */
import { sleep } from "k6";
import http from "k6/http";
import { check } from "k6";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.2/index.js";
import { randomIntBetween } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

import { classify } from "./lib/metrics.js";
import { loadWritePoolInit, getWritePool, pickSession } from "./lib/write-fixtures.js";
import {
  clinicalWriteConflicts,
  clinicalWriteDuration,
  recordWriteOutcome,
  writeThresholds,
} from "./lib/write-metrics.js";

const VUS = Number(__ENV.CONTENTION_VUS || "10");
const POOL = loadWritePoolInit();

export const options = {
  stages: [
    { duration: "10s", target: VUS },
    { duration: "2m", target: VUS },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    ...writeThresholds(),
    // contention may produce expected last-write-wins; still require high success
    clinical_write_success_rate: ["rate>=0.99"],
  },
};

export function setup() {
  const base = (__ENV.BASE_URL || __ENV.K6_BASE_URL || "").toLowerCase();
  if (!base) throw new Error("BASE_URL required");
  if (base.includes("drflow.opusorg.com") && !base.includes("staging") && !base.includes("preview")) {
    throw new Error("Refusing production URL");
  }
  const pool = getWritePool();
  const hot = (pool.sessions[0].record_ids || []).slice(0, 3);
  if (hot.length < 1) throw new Error("Need at least 1 hot record");
  return { hotRecordIds: hot, clinic_id: pool.sessions[0].clinic_id };
}

export default function clinicalWriteContention(data) {
  const session = pickSession(POOL, 1); // same clinic
  const base = (__ENV.BASE_URL || __ENV.K6_BASE_URL || "").replace(/\/$/, "");
  const recordId = data.hotRecordIds[__VU % data.hotRecordIds.length];
  const enriched = (session.records || []).find((r) => r.id === recordId);
  const patient_id = enriched?.patient_id || session.patient_ids[0];
  const professional_id = enriched?.professional_id || session.professional_ids[0];
  const marker = `CONTEND-${__VU}-${__ITER}-${Date.now()}`;

  const payload = {
    recordId,
    patient_id,
    professional_id,
    chief_complaint: "synthetic load test subject",
    evolution: "synthetic load test objective",
    diagnosis: `synthetic load test assessment ${marker}`,
    indications: "synthetic load test plan",
  };

  const tags = { operation: "contention_save", clinic: session.clinic_id.slice(0, 8) };
  const start = Date.now();
  const res = http.post(`${base}/api/clinical-records/persist`, JSON.stringify(payload), {
    headers: {
      Cookie: session.cookie,
      Origin: base,
      Referer: `${base}/historias`,
      "Content-Type": "application/json",
    },
    tags,
    timeout: "30s",
  });
  clinicalWriteDuration.add(Date.now() - start, tags);
  classify(res);
  recordWriteOutcome(res, tags);
  if (res.status === 409) clinicalWriteConflicts.add(1, tags);

  check(res, {
    "contention 2xx": (r) => r.status >= 200 && r.status < 300,
  });

  sleep(randomIntBetween(1, 3) / 10); // short think — intentional contention
}

export function handleSummary(data) {
  return {
    "coverage/load/write-contention.json": JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: " ", enableColors: false }),
  };
}

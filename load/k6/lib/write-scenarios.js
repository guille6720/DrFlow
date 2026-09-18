/**
 * Phase 7B clinical write scenarios — real persist API only.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { randomIntBetween } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

import { classify, opDuration } from "./metrics.js";
import { pickRecord } from "./write-fixtures.js";
import {
  clinicalReadbackDuration,
  clinicalWriteDuration,
  clinicalWriteReadbackMismatch,
  recordWriteOutcome,
} from "./write-metrics.js";

function baseUrl() {
  return (__ENV.BASE_URL || __ENV.K6_BASE_URL || "").replace(/\/$/, "");
}

function originHeaders(session) {
  const base = baseUrl();
  return {
    Cookie: session.cookie,
    Origin: base,
    Referer: `${base}/historias`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function thinkClinical() {
  sleep(randomIntBetween(2, 8));
}

function thinkConsult() {
  sleep(randomIntBetween(3, 10));
}

function thinkDx() {
  sleep(randomIntBetween(2, 6));
}

function thinkAppt() {
  sleep(randomIntBetween(1, 4));
}

function persistSoap(session, record, fields, operation) {
  const base = baseUrl();
  const recordId = typeof record === "string" ? record : record.id;
  const patient_id =
    (typeof record === "object" && record.patient_id) ||
    (session.patient_ids || [])[0] ||
    "";
  const professional_id =
    (typeof record === "object" && record.professional_id) ||
    (session.professional_ids || [])[0] ||
    "";
  if (!patient_id || !professional_id) {
    throw new Error("Missing patient_id/professional_id for write");
  }
  const token = `LT7B-${__VU}-${__ITER}-${Date.now()}`;
  const payload = {
    recordId,
    patient_id,
    professional_id,
    chief_complaint: fields.chief_complaint || "synthetic load test subject",
    evolution: fields.evolution || "synthetic load test objective",
    diagnosis: fields.diagnosis || `synthetic load test assessment ${token}`,
    indications: fields.indications || "synthetic load test plan",
  };

  const tags = {
    operation,
    clinic: session.clinic_id.slice(0, 8),
    endpoint: "clinical_persist",
  };
  const start = Date.now();
  const res = http.post(`${base}/api/clinical-records/persist`, JSON.stringify(payload), {
    headers: originHeaders(session),
    tags,
    timeout: "30s",
  });
  clinicalWriteDuration.add(Date.now() - start, tags);
  classify(res);
  recordWriteOutcome(res, tags);
  opDuration.add(res.timings.duration, tags);

  const ok = check(res, {
    [`${operation} status 2xx`]: (r) => r.status >= 200 && r.status < 300,
    [`${operation} success true`]: (r) => {
      try {
        const j = JSON.parse(r.body);
        return j.success === true;
      } catch {
        return false;
      }
    },
  });

  // Readback via edit page HTML (authenticated RSC) — look for token
  if (ok && token) {
    const rbStart = Date.now();
    const rb = http.get(`${base}/historias/${recordId}/editar`, {
      headers: {
        Cookie: session.cookie,
        Accept: "text/html",
      },
      tags: { ...tags, operation: `${operation}_readback` },
      timeout: "30s",
    });
    clinicalReadbackDuration.add(Date.now() - rbStart, tags);
    classify(rb);
    const body = String(rb.body || "");
    const matched =
      rb.status === 200 &&
      (body.includes(token) || body.includes("synthetic load test"));
    if (!matched) {
      clinicalWriteReadbackMismatch.add(1, tags);
    }
    check(null, {
      [`${operation} readback ok`]: () => matched,
    });
  }

  return { res, token, ok };
}

export function runClinicalSoapSave(session) {
  const record = pickRecord(session, __VU, __ITER);
  persistSoap(session, record, {}, "clinical_save");
  thinkClinical();
}

export function runConsultationUpdate(session) {
  const record = pickRecord(session, __VU, __ITER + 3);
  persistSoap(
    session,
    record,
    {
      evolution: `synthetic load test objective consult-${__VU}-${__ITER}`,
    },
    "consultation_update"
  );
  thinkConsult();
}

export function runDiagnosisWrite(session) {
  const record = pickRecord(session, __VU, __ITER + 7);
  persistSoap(
    session,
    record,
    {
      diagnosis: `synthetic load test assessment dx-${__VU}-${__ITER}-${Date.now()}`,
    },
    "diagnosis_write"
  );
  thinkDx();
}

export function runAppointmentMutation(session) {
  const appts = session.appointment_ids || [];
  if (!appts.length) {
    // fallback to SOAP if no appointments
    runClinicalSoapSave(session);
    return;
  }
  const appointmentId = appts[(__VU + __ITER) % appts.length];
  const base = baseUrl();
  const statuses = ["waiting", "in_consultation", "waiting"];
  const status = statuses[__ITER % statuses.length];
  const tags = {
    operation: "appointment_status",
    clinic: session.clinic_id.slice(0, 8),
    endpoint: "waiting_room_status",
  };
  const start = Date.now();
  const res = http.post(
    `${base}/api/waiting-room/status`,
    JSON.stringify({ appointmentId, status }),
    {
      headers: originHeaders(session),
      tags,
      timeout: "30s",
    }
  );
  clinicalWriteDuration.add(Date.now() - start, tags);
  classify(res);
  recordWriteOutcome(res, tags);
  check(res, {
    "appointment_status 2xx": (r) => r.status >= 200 && r.status < 300,
  });
  thinkAppt();
}

export function runHealthProbe(session) {
  const base = baseUrl();
  const res = http.get(`${base}/api/health/ready`, {
    tags: { operation: "health", endpoint: "ready" },
    timeout: "10s",
  });
  classify(res);
  sleep(randomIntBetween(1, 2));
}

/**
 * Weighted write mix (prescription issuance excluded — regulated).
 * 50% soap, 15% consultation, 10% diagnosis, 10% appointment, 15% redistributed from Rx → soap/health
 */
export function runWriteIteration(session) {
  const roll = randomIntBetween(1, 100);
  if (roll <= 50) runClinicalSoapSave(session);
  else if (roll <= 65) runConsultationUpdate(session);
  else if (roll <= 75) runDiagnosisWrite(session);
  else if (roll <= 85) runAppointmentMutation(session);
  else if (roll <= 95) runClinicalSoapSave(session); // was prescription slot
  else runHealthProbe(session);
}

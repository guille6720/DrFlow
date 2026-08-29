/**
 * Phase 7B write metrics (k6).
 */
import { Counter, Rate, Trend } from "k6/metrics";

export const clinicalWriteAttempts = new Counter("clinical_write_attempts");
export const clinicalWriteSuccess = new Counter("clinical_write_success");
export const clinicalWriteFailures = new Counter("clinical_write_failures");
export const clinicalWriteConflicts = new Counter("clinical_write_conflicts");
export const clinicalWrite409 = new Counter("clinical_write_409");
export const clinicalWrite429 = new Counter("clinical_write_429");
export const clinicalWrite5xx = new Counter("clinical_write_5xx");
export const clinicalWriteTimeouts = new Counter("clinical_write_timeouts");
export const clinicalWritePatientMismatch = new Counter("clinical_write_patient_mismatch");
export const clinicalWriteForbidden = new Counter("clinical_write_forbidden");
export const clinicalWriteAuditMissing = new Counter("clinical_write_audit_missing");
export const clinicalWriteReadbackMismatch = new Counter("clinical_write_readback_mismatch");
export const clinicalWriteTenantMismatch = new Counter("clinical_write_tenant_mismatch");

export const clinicalWriteDuration = new Trend("clinical_write_duration", true);
export const clinicalReadbackDuration = new Trend("clinical_readback_duration", true);
export const clinicalWriteSuccessRate = new Rate("clinical_write_success_rate");

export function writeThresholds() {
  return {
    http_req_failed: ["rate<0.01"],
    clinical_write_success_rate: ["rate>=0.999"],
    clinical_write_duration: ["p(95)<2000", "p(99)<3000"],
    clinical_write_429: ["count<3"],
    clinical_write_5xx: ["count<3"],
    clinical_write_patient_mismatch: ["count==0"],
    clinical_write_tenant_mismatch: ["count==0"],
    clinical_write_readback_mismatch: ["count==0"],
    clinical_write_forbidden: ["count==0"],
  };
}

export function recordWriteOutcome(res, tags = {}) {
  clinicalWriteAttempts.add(1, tags);
  if (res.status === 0) {
    clinicalWriteTimeouts.add(1, tags);
    clinicalWriteFailures.add(1, tags);
    clinicalWriteSuccessRate.add(false, tags);
    return;
  }
  if (res.status === 409) clinicalWrite409.add(1, tags);
  if (res.status === 429) clinicalWrite429.add(1, tags);
  if (res.status >= 500) clinicalWrite5xx.add(1, tags);
  if (res.status === 403) clinicalWriteForbidden.add(1, tags);

  const body = String(res.body || "");
  if (/PATIENT_MISMATCH|no corresponde al paciente/i.test(body)) {
    clinicalWritePatientMismatch.add(1, tags);
  }

  if (res.status >= 200 && res.status < 300) {
    clinicalWriteSuccess.add(1, tags);
    clinicalWriteSuccessRate.add(true, tags);
  } else {
    clinicalWriteFailures.add(1, tags);
    clinicalWriteSuccessRate.add(false, tags);
  }
}

#!/usr/bin/env node
/**
 * Load Phase 3 tenant-isolation fixture env (staging-only, gitignored).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const PHASE3_ENV_PATH = resolve(process.cwd(), "e2e/.phase3-tenant-env.local");

export const STAGING_TENANT_A_EMAIL = "drflow-release-qa@staging.drflow.invalid";
export const STAGING_TENANT_B_EMAIL = "drflow-tenant-b-qa@staging.drflow.invalid";
export const CLINIC_A_ID = "a0000000-0000-4000-8000-000000000001";

export function loadPhase3Env() {
  if (!existsSync(PHASE3_ENV_PATH)) return null;
  const out = {};
  for (const line of readFileSync(PHASE3_ENV_PATH, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

export function requirePhase3Env() {
  const env = loadPhase3Env();
  const required = [
    "PHASE3_CLINIC_A",
    "PHASE3_CLINIC_B",
    "PHASE3_PATIENT_A",
    "PHASE3_PATIENT_B",
    "PHASE3_RECORD_A",
    "PHASE3_RECORD_B",
    "PHASE3_ATTACHMENT_B_PATH",
    "PHASE3_SAME_CLINIC_PATIENT_B",
  ];
  for (const key of required) {
    if (!env?.[key]) return null;
  }
  return env;
}

export function loadPhase6PatientIds() {
  const path = resolve(process.cwd(), "e2e/.phase6-env.local");
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^E2E_PHASE6_PATIENT_(A|B)=(.+)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

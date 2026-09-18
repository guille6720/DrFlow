#!/usr/bin/env node
/**
 * Phase 5 — verify Sentry staging configuration via synthetic non-PHI exception.
 * Requires SENTRY_DSN and DRFLOW_SENTRY_STAGING=1.
 */
import { loadEnv } from "../_env.mjs";

const env = loadEnv({ required: false });
const dsn = process.env.SENTRY_DSN ?? env.SENTRY_DSN;
const stagingFlag = process.env.DRFLOW_SENTRY_STAGING ?? env.DRFLOW_SENTRY_STAGING;

console.log("\n🔭 Phase 5 — Sentry staging verification\n");

if (!dsn) {
  console.log("⚠ SENTRY_DSN not configured — skip (document in report)\n");
  process.exit(0);
}

if (stagingFlag !== "1") {
  console.log("⚠ DRFLOW_SENTRY_STAGING!=1 — runtime capture disabled; config documented only\n");
  process.exit(0);
}

const Sentry = await import("@sentry/node");

Sentry.init({
  dsn,
  environment: process.env.VERCEL_ENV ?? "preview",
  release: `drflow@${process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local"}`,
  tracesSampleRate: 0,
  beforeSend(event) {
    if (event.extra?.diagnosis) event.extra.diagnosis = "[redacted]";
    return event;
  },
});

const eventId = Sentry.captureException(new Error("Phase5SyntheticOpsTest — no PHI"), {
  tags: {
    "drflow.scope": "phase5.synthetic",
    synthetic: "true",
  },
  extra: {
    diagnosis: "SHOULD_BE_REDACTED",
    correlation_id: `phase5-sentry-${Date.now().toString(16)}`,
  },
});

await Sentry.flush(5000);

console.log(`   Event captured: ${eventId ?? "pending"}`);
console.log("   Verify in Sentry dashboard: environment, release SHA, no PHI in payload\n");
process.exit(eventId ? 0 : 1);

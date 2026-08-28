#!/usr/bin/env node
/**
 * Phase 5 — dispatch test operational alert (staging). No PHI.
 * Requires OPS_ALERT_WEBHOOK_URL in environment.
 */
import { loadEnv } from "../_env.mjs";

const env = loadEnv({ required: false });
const webhookUrl = process.env.OPS_ALERT_WEBHOOK_URL ?? env.OPS_ALERT_WEBHOOK_URL;

if (!webhookUrl?.startsWith("http")) {
  console.log("\n⚠ OPS_ALERT_WEBHOOK_URL not configured — alert dispatch skipped (not a failure in CI)\n");
  process.exit(0);
}

const payload = {
  type: "drflow_ops_alert",
  event_code: "readiness_failure",
  severity: "warning",
  message: "Phase 5 synthetic ops alert test — no PHI",
  environment: process.env.VERCEL_ENV ?? "staging",
  correlation_id: `phase5-${Date.now().toString(16)}`,
  timestamp: new Date().toISOString(),
  synthetic: true,
};

const res = await fetch(webhookUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

console.log(`\n📣 Ops alert test → HTTP ${res.status}\n`);
process.exit(res.ok ? 0 : 1);

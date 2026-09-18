import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  dispatchOpsAlert,
  resetOpsAlertDedupForTests,
} from "@/core/observability/ops-alert";
import { sanitizeMonitoringPayload } from "@/core/observability/sanitize-monitoring-payload";

describe("Phase 5 ops alerts", () => {
  const originalFetch = global.fetch;
  const originalWebhook = process.env.OPS_ALERT_WEBHOOK_URL;

  beforeEach(() => {
    resetOpsAlertDedupForTests();
    process.env.OPS_ALERT_WEBHOOK_URL = "https://example.test/ops-webhook";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalWebhook === undefined) {
      delete process.env.OPS_ALERT_WEBHOOK_URL;
    } else {
      process.env.OPS_ALERT_WEBHOOK_URL = originalWebhook;
    }
  });

  it("dispatches sanitized payload with correlation id", async () => {
    const calls: RequestInit[] = [];
    global.fetch = vi.fn(async (_url, init) => {
      calls.push(init!);
      return new Response("ok", { status: 200 });
    }) as typeof fetch;

    const sent = await dispatchOpsAlert({
      eventCode: "readiness_failure",
      severity: "critical",
      message: "patient_name Juan should not leak",
      correlationId: "abc123def4567890",
      metadata: { diagnosis: "Hypertension" },
    });

    expect(sent).toBe(true);
    expect(calls).toHaveLength(1);
    const body = JSON.parse(String(calls[0]?.body));
    expect(body.event_code).toBe("readiness_failure");
    expect(body.correlation_id).toBe("abc123def4567890");
    expect(body.diagnosis).toBe("[redacted]");
    expect(body.patient_name).toBeUndefined();
  });

  it("rate-limits duplicate alerts within dedup window", async () => {
    let count = 0;
    global.fetch = vi.fn(async () => {
      count += 1;
      return new Response("ok", { status: 200 });
    }) as typeof fetch;

    await dispatchOpsAlert({
      eventCode: "db_unavailable",
      severity: "critical",
      message: "first",
    });
    await dispatchOpsAlert({
      eventCode: "db_unavailable",
      severity: "critical",
      message: "second",
    });
    await dispatchOpsAlert({
      eventCode: "db_unavailable",
      severity: "critical",
      message: "third",
    });
    await dispatchOpsAlert({
      eventCode: "db_unavailable",
      severity: "critical",
      message: "fourth should drop",
    });

    expect(count).toBeLessThanOrEqual(3);
  });

  it("returns false when webhook not configured", async () => {
    delete process.env.OPS_ALERT_WEBHOOK_URL;
    global.fetch = vi.fn() as typeof fetch;
    const sent = await dispatchOpsAlert({
      eventCode: "elevated_429",
      severity: "warning",
      message: "skipped",
    });
    expect(sent).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("Phase 5 alert payload PHI safety", () => {
  it("redacts clinical fields from ops alert metadata", () => {
    const clean = sanitizeMonitoringPayload({
      event_code: "clinical_save_failure_spike",
      chief_complaint: "Chest pain",
      document_number: "30123456",
      safe: true,
    });
    expect(clean.chief_complaint).toBe("[redacted]");
    expect(clean.document_number).toBe("[redacted]");
    expect(clean.safe).toBe(true);
  });
});

describe("Phase 5 migration preflight patterns", () => {
  it("detects destructive SQL in executable portion only", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const script = readFileSync(
      join(process.cwd(), "scripts/disaster-recovery/migration-preflight.mjs"),
      "utf8"
    );
    expect(script).toContain("stripSqlComments");
    expect(script).toContain("DROP\\s+TABLE");
  });
});

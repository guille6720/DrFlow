import { describe, expect, it } from "vitest";

import {
  CATEGORY_LABELS,
  inferStatusFromDuration,
  SLOW_JOB_MS,
  SLOW_QUERY_MS,
  SLOW_REQUEST_MS,
  thresholdForCategory,
} from "@/core/observability/types";

describe("observability thresholds", () => {
  it("defines slow query and job thresholds", () => {
    expect(SLOW_QUERY_MS).toBe(500);
    expect(SLOW_JOB_MS).toBe(5000);
  });

  it("infers warn/error from duration", () => {
    expect(inferStatusFromDuration(100, SLOW_QUERY_MS, "query")).toBe("ok");
    expect(inferStatusFromDuration(600, SLOW_QUERY_MS, "query")).toBe("warn");
    expect(inferStatusFromDuration(1200, SLOW_QUERY_MS, "query")).toBe("error");
  });

  it("maps category thresholds", () => {
    expect(thresholdForCategory("query")).toBe(SLOW_QUERY_MS);
    expect(thresholdForCategory("job")).toBe(SLOW_JOB_MS);
    expect(thresholdForCategory("api")).toBe(SLOW_REQUEST_MS);
    expect(thresholdForCategory("performance")).toBe(SLOW_REQUEST_MS);
    expect(thresholdForCategory("error")).toBe(SLOW_REQUEST_MS);
  });

  it("forces error status for error category", () => {
    expect(inferStatusFromDuration(10, SLOW_QUERY_MS, "error")).toBe("error");
  });

  it("has category labels", () => {
    expect(CATEGORY_LABELS.error).toBe("Error");
    expect(CATEGORY_LABELS.job).toBe("Job");
  });
});

describe("052_observability_phase16 migration", () => {
  it("creates clinic_observability_events table", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/052_observability_phase16.sql"),
      "utf8"
    );
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS clinic_observability_events/);
    expect(sql).toMatch(/purge_old_observability_events/);
  });
});

describe("createTraceId", () => {
  it("generates 16-char trace ids", async () => {
    const { createTraceId } = await import("@/core/observability/trace-id");
    const id = createTraceId();
    expect(id).toHaveLength(16);
    expect(id).toMatch(/^[a-f0-9]+$/);
  });
});

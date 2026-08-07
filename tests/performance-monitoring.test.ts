import { describe, expect, it } from "vitest";

import {
  clientObservabilityBatchSchema,
  type ClientObservabilityEvent,
} from "@/core/observability/client-ingest-schema";
import { inferWebVitalStatus, WEB_VITAL_THRESHOLDS } from "@/core/observability/web-vitals-thresholds";

import { createSupabaseTestDouble } from "./helpers/mock-supabase-client";

describe("client observability ingest schema", () => {
  it("accepts valid performance batch", () => {
    const events: ClientObservabilityEvent[] = [
      {
        category: "performance",
        name: "web_vital_lcp",
        durationMs: 2100,
        path: "/dashboard",
        metadata: { metric: "LCP", value: 2100 },
      },
    ];
    const parsed = clientObservabilityBatchSchema.safeParse({ events });
    expect(parsed.success).toBe(true);
  });

  it("rejects batches over 10 events", () => {
    const events = Array.from({ length: 11 }, (_, i) => ({
      category: "error" as const,
      name: `err_${i}`,
    }));
    const parsed = clientObservabilityBatchSchema.safeParse({ events });
    expect(parsed.success).toBe(false);
  });
});

describe("web vitals thresholds", () => {
  it("defines LCP thresholds", () => {
    expect(WEB_VITAL_THRESHOLDS.LCP.warn).toBe(2500);
    expect(WEB_VITAL_THRESHOLDS.LCP.error).toBe(4000);
  });

  it("infers status from LCP value", () => {
    expect(inferWebVitalStatus("LCP", 2000)).toBe("ok");
    expect(inferWebVitalStatus("LCP", 3000)).toBe("warn");
    expect(inferWebVitalStatus("LCP", 5000)).toBe("error");
  });

  it("infers status from CLS score", () => {
    expect(inferWebVitalStatus("CLS", 0.05)).toBe("ok");
    expect(inferWebVitalStatus("CLS", 0.15)).toBe("warn");
    expect(inferWebVitalStatus("CLS", 0.3)).toBe("error");
  });
});

describe("load-observability percentile", () => {
  it("computes p75 for LCP values", async () => {
    const { loadObservabilitySnapshot } = await import("@/lib/server/load-observability");

    const mockRows = [
      { id: "1", category: "performance", name: "web_vital_lcp", status: "ok", path: null, duration_ms: 1000, trace_id: null, error_message: null, created_at: new Date().toISOString() },
      { id: "2", category: "performance", name: "web_vital_lcp", status: "ok", path: null, duration_ms: 2000, trace_id: null, error_message: null, created_at: new Date().toISOString() },
      { id: "3", category: "performance", name: "web_vital_lcp", status: "warn", path: null, duration_ms: 3000, trace_id: null, error_message: null, created_at: new Date().toISOString() },
      { id: "4", category: "performance", name: "web_vital_lcp", status: "warn", path: null, duration_ms: 4000, trace_id: null, error_message: null, created_at: new Date().toISOString() },
    ];

    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              order: () => ({
                limit: async () => ({ data: mockRows, error: null }),
              }),
            }),
          }),
        }),
      }),
    };

    const snapshot = await loadObservabilitySnapshot(createSupabaseTestDouble(supabase), "clinic-1");
    expect(snapshot.last24h.p75LcpMs).toBe(3000);
    expect(snapshot.last24h.webVitalsPoor).toBe(2);
  });
});

describe("isClientObservabilityEnabled", () => {
  it("is false outside browser", async () => {
    const { isClientObservabilityEnabled } = await import("@/core/observability/client-reporter");
    expect(isClientObservabilityEnabled()).toBe(false);
  });
});

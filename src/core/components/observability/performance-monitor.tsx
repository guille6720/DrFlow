"use client";

import { useEffect } from "react";

import {
  flushClientObservabilityQueue,
  isClientObservabilityEnabled,
  reportClientObservabilityEvent,
} from "@/core/observability/client-reporter";
import { inferWebVitalStatus } from "@/core/observability/web-vitals-thresholds";

/**
 * Collects Web Vitals and navigation timing — production only, batched ingest.
 */
export function PerformanceMonitor() {
  useEffect(() => {
    if (!isClientObservabilityEnabled()) return;

    const path = window.location.pathname;

    void import("web-vitals").then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
      const report = (name: string, value: number, rating?: string) => {
        reportClientObservabilityEvent({
          category: "performance",
          name: `web_vital_${name.toLowerCase()}`,
          status: inferWebVitalStatus(name, value),
          path,
          durationMs: Math.round(value),
          metadata: { metric: name, value, rating },
        });
      };

      onLCP((metric) => report("LCP", metric.value, metric.rating));
      onINP((metric) => report("INP", metric.value, metric.rating));
      onCLS((metric) => report("CLS", metric.value, metric.rating));
      onFCP((metric) => report("FCP", metric.value, metric.rating));
      onTTFB((metric) => report("TTFB", metric.value, metric.rating));
    });

    try {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (nav && nav.loadEventEnd > 0) {
        const loadMs = Math.round(nav.loadEventEnd - nav.startTime);
        reportClientObservabilityEvent({
          category: "performance",
          name: "page_load",
          path,
          durationMs: loadMs,
          status: loadMs >= 4000 ? "warn" : "ok",
          metadata: {
            domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
            transferSize: nav.transferSize,
          },
        });
      }
    } catch {
      // Performance API unavailable
    }

    return () => flushClientObservabilityQueue();
  }, []);

  return null;
}

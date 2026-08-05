"use client";

import type { ClientObservabilityEvent } from "@/core/observability/client-ingest-schema";

const FLUSH_DELAY_MS = 2000;
const MAX_BATCH = 5;
const MAX_EVENTS_PER_WINDOW = 30;
const RATE_WINDOW_MS = 5 * 60 * 1000;
const INGEST_PATH = "/api/observability/events";

const queue: ClientObservabilityEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let eventsInWindow = 0;
let windowStartedAt = 0;

export function isClientObservabilityEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_OBSERVABILITY_CLIENT === "0") return false;
  return (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_OBSERVABILITY_CLIENT === "1"
  );
}

function canSendMore(): boolean {
  const now = Date.now();
  if (now - windowStartedAt > RATE_WINDOW_MS) {
    windowStartedAt = now;
    eventsInWindow = 0;
  }
  return eventsInWindow < MAX_EVENTS_PER_WINDOW;
}

function sendPayload(events: ClientObservabilityEvent[]): void {
  if (events.length === 0) return;

  const body = JSON.stringify({ events });
  eventsInWindow += events.length;

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon(INGEST_PATH, blob)) return;
  }

  void fetch(INGEST_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => {
    // Silent — observability must not affect UX
  });
}

function flushQueue(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (queue.length === 0) return;

  const batch = queue.splice(0, MAX_BATCH);
  sendPayload(batch);

  if (queue.length > 0) {
    flushTimer = setTimeout(flushQueue, FLUSH_DELAY_MS);
  }
}

/** Fire-and-forget client event — batched and rate-limited. */
export function reportClientObservabilityEvent(event: ClientObservabilityEvent): void {
  if (!isClientObservabilityEnabled() || !canSendMore()) return;

  queue.push(event);

  if (queue.length >= MAX_BATCH) {
    flushQueue();
    return;
  }

  if (!flushTimer) {
    flushTimer = setTimeout(flushQueue, FLUSH_DELAY_MS);
  }
}

export function flushClientObservabilityQueue(): void {
  flushQueue();
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => flushQueue());
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushQueue();
  });
}

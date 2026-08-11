"use client";

import { useEffect } from "react";

import { initSentryClient, isClientSentryEnabled } from "@/core/observability/sentry.client";

/** Initializes browser Sentry once when NEXT_PUBLIC_SENTRY_DSN is configured. */
export function SentryInit() {
  useEffect(() => {
    if (!isClientSentryEnabled()) return;
    void initSentryClient();
  }, []);

  return null;
}

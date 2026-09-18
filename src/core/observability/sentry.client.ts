"use client";

import { sanitizeSentryEventInPlace, sanitizeTelemetryMetadata } from "@/core/observability/sanitize-monitoring-payload";

type SentryBrowser = typeof import("@sentry/browser");

let sentryModule: SentryBrowser | null = null;
let initialized = false;
let rejectionHookInstalled = false;

function clientBuildId(): string {
  return (
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    process.env.NEXT_PUBLIC_APP_VERSION?.trim() ||
    "local"
  );
}

function getSentryDsn(): string | undefined {
  return process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || undefined;
}

function isSentryRuntimeEnabled(): boolean {
  if (!getSentryDsn()) return false;
  if (process.env.NEXT_PUBLIC_DRFLOW_SENTRY_DISABLED === "1") return false;
  const env = process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
  return env === "production" || env === "preview" || process.env.NEXT_PUBLIC_DRFLOW_SENTRY_STAGING === "1";
}

export function isClientSentryEnabled(): boolean {
  return isSentryRuntimeEnabled();
}

async function loadSentry(): Promise<SentryBrowser | null> {
  if (!isClientSentryEnabled()) return null;
  if (!sentryModule) {
    sentryModule = await import("@sentry/browser");
  }
  return sentryModule;
}

function installUnhandledRejectionHook(Sentry: SentryBrowser): void {
  if (rejectionHookInstalled || typeof window === "undefined") return;
  rejectionHookInstalled = true;
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    if (reason instanceof Error || typeof reason === "string") {
      Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
    }
  });
}

export async function initSentryClient(): Promise<void> {
  if (initialized || !isClientSentryEnabled()) return;

  const Sentry = await loadSentry();
  if (!Sentry) return;

  Sentry.init({
    dsn: getSentryDsn(),
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    release: `drflow@${clientBuildId()}`,
    tracesSampleRate: 0,
    enabled: isSentryRuntimeEnabled(),
    beforeSend(event) {
      sanitizeSentryEventInPlace(event);
      return event;
    },
  });

  installUnhandledRejectionHook(Sentry);
  initialized = true;
}

export async function captureClientException(
  error: unknown,
  context?: {
    scope?: string;
    path?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  if (!isClientSentryEnabled()) return;

  await initSentryClient();
  const Sentry = await loadSentry();
  if (!Sentry) return;

  const metadata = sanitizeTelemetryMetadata(context?.metadata);

  Sentry.withScope((scope) => {
    if (context?.scope) scope.setTag("drflow.scope", context.scope);
    if (context?.path) scope.setTag("drflow.path", context.path);
    scope.setTag("drflow.release", clientBuildId());
    if (metadata) scope.setContext("metadata", metadata);
    Sentry.captureException(error);
  });
}

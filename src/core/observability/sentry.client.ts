"use client";

type SentryBrowser = typeof import("@sentry/browser");

let sentryModule: SentryBrowser | null = null;
let initialized = false;

function getSentryDsn(): string | undefined {
  return process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || undefined;
}

export function isClientSentryEnabled(): boolean {
  return Boolean(getSentryDsn());
}

async function loadSentry(): Promise<SentryBrowser | null> {
  if (!isClientSentryEnabled()) return null;
  if (!sentryModule) {
    sentryModule = await import("@sentry/browser");
  }
  return sentryModule;
}

export async function initSentryClient(): Promise<void> {
  if (initialized || !isClientSentryEnabled()) return;

  const Sentry = await loadSentry();
  if (!Sentry) return;

  Sentry.init({
    dsn: getSentryDsn(),
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0,
    enabled: process.env.NODE_ENV === "production",
  });

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

  Sentry.withScope((scope) => {
    if (context?.scope) scope.setTag("drflow.scope", context.scope);
    if (context?.path) scope.setTag("drflow.path", context.path);
    if (context?.metadata) scope.setContext("metadata", context.metadata);
    Sentry.captureException(error);
  });
}

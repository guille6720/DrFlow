import "server-only";

import { getBuildId } from "@/core/app-release";
import { sanitizeSentryEventInPlace, sanitizeTelemetryMetadata } from "@/core/observability/sanitize-monitoring-payload";

type SentryNode = typeof import("@sentry/node");

let sentryModule: SentryNode | null = null;
let loadPromise: Promise<SentryNode | null> | null = null;
let initialized = false;

function getSentryDsn(): string | undefined {
  return process.env.SENTRY_DSN?.trim() || undefined;
}

function isSentryRuntimeEnabled(): boolean {
  if (!getSentryDsn()) return false;
  if (process.env.DRFLOW_SENTRY_DISABLED === "1") return false;
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
  return env === "production" || env === "preview" || process.env.DRFLOW_SENTRY_STAGING === "1";
}

export function isSentryEnabled(): boolean {
  return isSentryRuntimeEnabled();
}

async function loadSentry(): Promise<SentryNode | null> {
  if (!isSentryEnabled()) return null;
  if (sentryModule) return sentryModule;
  if (!loadPromise) {
    loadPromise = import("@sentry/node").then((mod) => {
      sentryModule = mod;
      return mod;
    });
  }
  return loadPromise;
}

export async function initSentryServer(): Promise<void> {
  if (initialized || !isSentryEnabled()) return;

  const Sentry = await loadSentry();
  if (!Sentry) return;

  Sentry.init({
    dsn: getSentryDsn(),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    release: `drflow@${getBuildId()}`,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
    enabled: isSentryRuntimeEnabled(),
    beforeSend(event) {
      sanitizeSentryEventInPlace(event);
      return event;
    },
  });

  initialized = true;
}

export function captureServerException(
  error: unknown,
  context?: {
    scope?: string;
    clinicId?: string | null;
    path?: string;
    traceId?: string;
    metadata?: Record<string, unknown>;
  }
): void {
  if (!isSentryEnabled()) return;

  void (async () => {
    await initSentryServer();
    const Sentry = await loadSentry();
    if (!Sentry) return;

    const metadata = sanitizeTelemetryMetadata(context?.metadata);

    Sentry.withScope((scope) => {
      if (context?.scope) scope.setTag("drflow.scope", context.scope);
      if (context?.clinicId) scope.setTag("drflow.clinic_id", context.clinicId);
      if (context?.path) scope.setTag("drflow.path", context.path);
      if (context?.traceId) scope.setTag("drflow.trace_id", context.traceId);
      scope.setTag("drflow.release", getBuildId());
      if (metadata) scope.setContext("metadata", metadata);
      Sentry.captureException(error);
    });
  })();
}

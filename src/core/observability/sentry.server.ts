import "server-only";

type SentryNode = typeof import("@sentry/node");

let sentryModule: SentryNode | null = null;
let loadPromise: Promise<SentryNode | null> | null = null;
let initialized = false;

function getSentryDsn(): string | undefined {
  return process.env.SENTRY_DSN?.trim() || undefined;
}

export function isSentryEnabled(): boolean {
  return Boolean(getSentryDsn());
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
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
    enabled: process.env.NODE_ENV === "production",
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

    Sentry.withScope((scope) => {
      if (context?.scope) scope.setTag("drflow.scope", context.scope);
      if (context?.clinicId) scope.setTag("drflow.clinic_id", context.clinicId);
      if (context?.path) scope.setTag("drflow.path", context.path);
      if (context?.traceId) scope.setTag("drflow.trace_id", context.traceId);
      if (context?.metadata) scope.setContext("metadata", context.metadata);
      Sentry.captureException(error);
    });
  })();
}

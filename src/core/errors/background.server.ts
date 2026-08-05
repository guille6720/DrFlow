import "server-only";

import { after } from "next/server";

import { logServerError } from "@/core/errors/log-error.server";

export type BackgroundTaskOptions = {
  clinicId?: string | null;
  metadata?: Record<string, unknown>;
};

/** Runs async work and logs failures without rethrowing. */
export async function runBackgroundTask(
  scope: string,
  fn: () => Promise<unknown>,
  options?: BackgroundTaskOptions
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    logServerError(scope, error, options);
  }
}

/** Schedules work via Next.js `after()` with consistent error logging. */
export function scheduleAfterTask(
  scope: string,
  fn: () => Promise<unknown>,
  options?: BackgroundTaskOptions
): void {
  after(() => runBackgroundTask(scope, fn, options));
}

/** Attaches `.catch` logging to fire-and-forget promises. */
export function scheduleFireAndForget(
  scope: string,
  promise: Promise<unknown>,
  options?: BackgroundTaskOptions
): void {
  void promise.catch((error) => logServerError(scope, error, options));
}

/**
 * Transport helpers shared by provider adapters: per-attempt timeout and bounded exponential backoff.
 * Only taxonomy-retryable errors are retried; the idempotency key is identical across attempts.
 */

import {
  RepositoryProviderError,
  toRepositoryProviderError,
} from "@/core/renapdis/repository/repository-errors";

export type RetryPolicy = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = { maxAttempts: 3, baseDelayMs: 400, maxDelayMs: 4_000 };

export type RetryHooks = {
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  onRetry?: (info: { attempt: number; code: string; delayMs: number }) => void;
};

export function computeBackoffDelay(attempt: number, policy: RetryPolicy, random: () => number = Math.random): number {
  const exp = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(exp * 0.2 * random());
  return Math.min(policy.maxDelayMs, exp + jitter);
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withRepositoryRetry<T>(
  operation: (attempt: number) => Promise<T>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  hooks: RetryHooks = {}
): Promise<{ value: T; attempts: number }> {
  const sleep = hooks.sleep ?? defaultSleep;
  const maxAttempts = Math.max(1, Math.min(policy.maxAttempts, 5));
  let lastError: RepositoryProviderError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return { value: await operation(attempt), attempts: attempt };
    } catch (raw) {
      const error = toRepositoryProviderError(raw);
      lastError = error;
      if (!error.retryable || attempt === maxAttempts) throw error;
      const delayMs = computeBackoffDelay(attempt, policy, hooks.random);
      hooks.onRetry?.({ attempt, code: error.code, delayMs });
      await sleep(delayMs);
    }
  }
  throw lastError ?? new RepositoryProviderError("provider_unavailable");
}

/** Runs `fn` with an AbortSignal that fires after `timeoutMs`. */
export async function withAttemptTimeout<T>(timeoutMs: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) throw new RepositoryProviderError("network_timeout");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

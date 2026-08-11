const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;

const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkPublicApiRateLimit(keyId: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(keyId);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(keyId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (bucket.count >= MAX_REQUESTS) {
    return false;
  }

  bucket.count += 1;
  return true;
}

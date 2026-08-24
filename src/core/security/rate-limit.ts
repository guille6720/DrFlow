export type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
};

const buckets = new Map<string, { count: number; resetAt: number }>();

/** In-memory sliding window limiter (per serverless instance). */
export function checkRateLimit(key: string, config: RateLimitConfig): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + config.windowMs });
    return true;
  }

  if (bucket.count >= config.maxRequests) {
    return false;
  }

  bucket.count += 1;
  return true;
}

export const AUTH_LOGIN_RATE_LIMIT: RateLimitConfig = {
  windowMs: 15 * 60 * 1000,
  maxRequests: 30,
};

export const AUTH_RESET_RATE_LIMIT: RateLimitConfig = {
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
};

/** Best-effort client IP for auth throttling behind Vercel/proxy. */
export function getRequestClientIp(request: Pick<Request, "headers">): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp || "unknown";
}

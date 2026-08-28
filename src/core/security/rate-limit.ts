/**
 * Distributed-capable rate limiter with safe in-memory fallback.
 *
 * Production / multi-instance (Vercel): set either
 *   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * or
 *   RATE_LIMIT_REDIS_REST_URL + RATE_LIMIT_REDIS_REST_TOKEN
 *
 * Without Redis, falls back to per-instance memory (documented limitation).
 */
export type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
};

export type RateLimitResult = {
  allowed: boolean;
  backend: "redis" | "memory";
  remaining: number;
};

type Bucket = { count: number; resetAt: number };

const memoryBuckets = new Map<string, Bucket>();

function resolveRedisConfig(): { url: string; token: string } | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    process.env.RATE_LIMIT_REDIS_REST_URL?.trim() ||
    "";
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    process.env.RATE_LIMIT_REDIS_REST_TOKEN?.trim() ||
    "";
  if (!url.startsWith("http") || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

function checkMemory(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    memoryBuckets.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, backend: "memory", remaining: config.maxRequests - 1 };
  }

  if (bucket.count >= config.maxRequests) {
    return { allowed: false, backend: "memory", remaining: 0 };
  }

  bucket.count += 1;
  return {
    allowed: true,
    backend: "memory",
    remaining: Math.max(0, config.maxRequests - bucket.count),
  };
}

/**
 * Fixed-window counter via Upstash REST (no SDK dependency).
 * Key format: rl:{key}:{windowBucket}
 */
async function checkRedis(
  key: string,
  config: RateLimitConfig,
  redis: { url: string; token: string }
): Promise<RateLimitResult | null> {
  const windowBucket = Math.floor(Date.now() / config.windowMs);
  const redisKey = `drflow:rl:${key}:${windowBucket}`;
  const ttlSec = Math.ceil(config.windowMs / 1000) + 1;

  try {
    const incrRes = await fetch(`${redis.url}/incr/${encodeURIComponent(redisKey)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${redis.token}` },
      signal: AbortSignal.timeout(1500),
    });
    if (!incrRes.ok) return null;
    const incrBody = (await incrRes.json()) as { result?: number };
    const count = Number(incrBody.result ?? 0);
    if (count === 1) {
      await fetch(`${redis.url}/expire/${encodeURIComponent(redisKey)}/${ttlSec}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${redis.token}` },
        signal: AbortSignal.timeout(1500),
      }).catch(() => undefined);
    }
    if (count > config.maxRequests) {
      return { allowed: false, backend: "redis", remaining: 0 };
    }
    return {
      allowed: true,
      backend: "redis",
      remaining: Math.max(0, config.maxRequests - count),
    };
  } catch {
    return null;
  }
}

/** Async rate limit — prefers Redis when configured; never throws. */
export async function checkRateLimitAsync(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = resolveRedisConfig();
  if (redis) {
    const remote = await checkRedis(key, config, redis);
    if (remote) return remote;
  }
  return checkMemory(key, config);
}

/** Sync helper for call sites that cannot await — memory only, or fire-and-forget Redis. */
export function checkRateLimit(key: string, config: RateLimitConfig): boolean {
  return checkMemory(key, config).allowed;
}

export function isDistributedRateLimitConfigured(): boolean {
  return resolveRedisConfig() !== null;
}

export const AUTH_LOGIN_RATE_LIMIT: RateLimitConfig = {
  windowMs: 15 * 60 * 1000,
  maxRequests: 30,
};

export const AUTH_RESET_RATE_LIMIT: RateLimitConfig = {
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
};

export const SEARCH_API_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 90,
};

export const AI_API_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 40,
};

export const EXPORT_API_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 20,
};

export const SENSITIVE_MUTATION_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 60,
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

/** Test helper — clear memory buckets. */
export function resetRateLimitMemoryForTests(): void {
  memoryBuckets.clear();
}

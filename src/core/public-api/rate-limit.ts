import { checkRateLimitAsync, type RateLimitConfig } from "@/core/security/rate-limit";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;

const PUBLIC_API_RATE_LIMIT: RateLimitConfig = {
  windowMs: WINDOW_MS,
  maxRequests: MAX_REQUESTS,
};

/** Public API key rate limit — Redis when configured, else memory fallback. */
export async function checkPublicApiRateLimit(keyId: string): Promise<boolean> {
  const result = await checkRateLimitAsync(`public-api:${keyId}`, PUBLIC_API_RATE_LIMIT);
  return result.allowed;
}

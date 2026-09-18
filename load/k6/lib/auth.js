/**
 * Session cookie auth helpers for application capacity (not password login).
 */
export function sessionHeaders() {
  const cookie = __ENV.K6_SESSION_COOKIE || "";
  if (!cookie) return null;
  return { Cookie: cookie };
}

export function requireSessionOrAbort() {
  const headers = sessionHeaders();
  if (!headers) {
    throw new Error("K6_SESSION_COOKIE required for MODE=app — do not run anonymous load as capacity evidence");
  }
  return headers;
}

export function baseUrl() {
  return (__ENV.BASE_URL || __ENV.K6_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
}

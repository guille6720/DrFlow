import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  APPLICATION_SECURITY_REQUIREMENTS,
  APPLICATION_SECURITY_SURFACES,
  evaluateApplicationSecurityPosture,
  SECURE_SESSION_COOKIE_POLICY,
} from "@/core/compliance/application-security";
import {
  AUTH_LOGIN_RATE_LIMIT,
  AUTH_RESET_RATE_LIMIT,
  checkRateLimit,
  getRequestClientIp,
} from "@/core/security/rate-limit";
import { SECURITY_RESPONSE_HEADERS } from "@/core/security/response-headers";
import { isSafeOutboundUrl } from "@/core/security/ssrf";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("application-security policy module", () => {
  it("documents secure session cookie defaults", () => {
    expect(SECURE_SESSION_COOKIE_POLICY.httpOnly).toBe(true);
    expect(SECURE_SESSION_COOKIE_POLICY.sameSite).toBe("lax");
    expect(SECURE_SESSION_COOKIE_POLICY.secureInProduction).toBe(true);
  });

  it("covers PHASE 15 requirement areas", () => {
    const ids = APPLICATION_SECURITY_REQUIREMENTS.map((r) => r.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "security_headers",
        "csrf",
        "secure_cookies",
        "open_redirect",
        "xss",
        "sql_injection",
        "ssrf",
        "file_upload",
        "rate_limit",
        "brute_force",
      ])
    );
  });

  it("lists protected application surfaces", () => {
    const ids = APPLICATION_SECURITY_SURFACES.map((s) => s.id);
    expect(ids).toContain("auth_login");
    expect(ids).toContain("billing_checkout");
    expect(ids).toContain("public_api");
  });

  it("evaluateApplicationSecurityPosture reports auth limits", () => {
    const posture = evaluateApplicationSecurityPosture();
    expect(posture.authLoginLimit.maxRequests).toBe(AUTH_LOGIN_RATE_LIMIT.maxRequests);
    expect(posture.authResetLimit.maxRequests).toBe(AUTH_RESET_RATE_LIMIT.maxRequests);
    expect(posture.headerCount).toBeGreaterThanOrEqual(8);
  });
});

describe("rate-limit helpers", () => {
  it("throttles after max requests in window", () => {
    const key = `test:${Date.now()}`;
    const config = { windowMs: 60_000, maxRequests: 2 };
    expect(checkRateLimit(key, config)).toBe(true);
    expect(checkRateLimit(key, config)).toBe(true);
    expect(checkRateLimit(key, config)).toBe(false);
  });

  it("extracts client IP from x-forwarded-for", () => {
    const request = {
      headers: new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }),
    };
    expect(getRequestClientIp(request)).toBe("203.0.113.5");
  });
});

describe("ssrf guards", () => {
  it("blocks localhost and private IPs", () => {
    expect(isSafeOutboundUrl("https://localhost/secret")).toBe(false);
    expect(isSafeOutboundUrl("https://127.0.0.1/secret")).toBe(false);
    expect(isSafeOutboundUrl("https://192.168.0.1/secret")).toBe(false);
    expect(isSafeOutboundUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
  });

  it("allows https to allowlisted hosts", () => {
    expect(
      isSafeOutboundUrl("https://abc.supabase.co/storage/v1/object/sign/x", {
        allowedHostnameSuffixes: ["supabase.co"],
      })
    ).toBe(true);
    expect(
      isSafeOutboundUrl("https://evil.example/secret", {
        allowedHostnameSuffixes: ["supabase.co"],
      })
    ).toBe(false);
  });
});

describe("security response headers", () => {
  it("includes CSP, HSTS, COOP and frame denial", () => {
    const keys = SECURITY_RESPONSE_HEADERS.map((h) => h.key);
    expect(keys).toContain("Content-Security-Policy");
    expect(keys).toContain("Strict-Transport-Security");
    expect(keys).toContain("X-Frame-Options");
    expect(keys).toContain("Cross-Origin-Opener-Policy");
    expect(keys).toContain("Permissions-Policy");
  });

  it("denies framing in CSP", () => {
    const csp = SECURITY_RESPONSE_HEADERS.find((h) => h.key === "Content-Security-Policy");
    expect(csp?.value).toContain("frame-ancestors 'none'");
    expect(csp?.value).toContain("supabase.co");
  });
});

describe("Phase 15 app wiring (static)", () => {
  it("auth login uses CSRF and rate limit", () => {
    const src = read("src/app/api/auth/login/route.ts");
    expect(src).toContain("isSameOriginPost");
    expect(src).toContain("checkRateLimitAsync");
    expect(src).toContain("AUTH_LOGIN_RATE_LIMIT");
    expect(src).toContain("getRequestClientIp");
  });

  it("auth reset uses CSRF and rate limit", () => {
    const src = read("src/app/api/auth/reset-password/route.ts");
    expect(src).toContain("isSameOriginPost");
    expect(src).toContain("AUTH_RESET_RATE_LIMIT");
    expect(src).toContain("checkRateLimitAsync");
  });

  it("billing checkout requires same-origin mutation", () => {
    const src = read("src/app/api/billing/create-preference/route.ts");
    expect(src).toContain("requireSameOriginMutation");
    expect(src).toContain("requireSettingsAccess");
  });

  it("pdf image resolver blocks unsafe outbound URLs", () => {
    const src = read("src/lib/utils/pdf-image-data-url.ts");
    expect(src).toContain("isSafeOutboundUrl");
    expect(src).toContain('cache: "no-store"');
  });

  it("device session cookies are httpOnly and lax", () => {
    const src = read("src/lib/auth/device-sessions.ts");
    expect(src).toContain("httpOnly: true");
    expect(src).toContain('sameSite: "lax"');
  });

  it("vercel.json mirrors hardened headers", () => {
    const json = read("vercel.json");
    expect(json).toContain("Cross-Origin-Opener-Policy");
    expect(json).toContain("Content-Security-Policy");
    expect(json).toContain("frame-ancestors 'none'");
  });
});

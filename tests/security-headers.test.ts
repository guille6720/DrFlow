import { describe, it, expect } from "vitest";
import { SECURITY_RESPONSE_HEADERS } from "@/core/security/response-headers";

describe("Security response headers", () => {
  it("includes CSP, HSTS and frame denial", () => {
    const keys = SECURITY_RESPONSE_HEADERS.map((h) => h.key);
    expect(keys).toContain("Content-Security-Policy");
    expect(keys).toContain("Strict-Transport-Security");
    expect(keys).toContain("X-Frame-Options");
  });

  it("allows Supabase connect in CSP", () => {
    const csp = SECURITY_RESPONSE_HEADERS.find((h) => h.key === "Content-Security-Policy");
    expect(csp?.value).toContain("supabase.co");
  });
});

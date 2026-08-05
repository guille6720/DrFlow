import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { isSameOriginPost } from "@/core/security/csrf";
import {
  assertSameClinic,
  clinicScopedIdFilter,
  isSameClinic,
  requireResourceInClinic,
  TenantScopeError,
} from "@/core/security/tenant-scope";

function mockRequest(headers: Record<string, string>) {
  return new NextRequest("https://drflow.opusorg.com/api/auth/login", {
    method: "POST",
    headers,
  });
}

describe("isSameOriginPost", () => {
  it("accepts matching origin", () => {
    const req = mockRequest({
      host: "drflow.opusorg.com",
      origin: "https://drflow.opusorg.com",
    });
    expect(isSameOriginPost(req)).toBe(true);
  });

  it("accepts matching referer when origin absent", () => {
    const req = mockRequest({
      host: "drflow.opusorg.com",
      referer: "https://drflow.opusorg.com/dashboard",
    });
    expect(isSameOriginPost(req)).toBe(true);
  });

  it("rejects cross-origin", () => {
    const req = mockRequest({
      host: "drflow.opusorg.com",
      origin: "https://evil.example",
    });
    expect(isSameOriginPost(req)).toBe(false);
  });

  it("rejects malformed origin URL", () => {
    const req = mockRequest({
      host: "drflow.opusorg.com",
      origin: "not-a-valid-url",
    });
    expect(isSameOriginPost(req)).toBe(false);
  });

  it("rejects malformed referer URL", () => {
    const req = mockRequest({
      host: "drflow.opusorg.com",
      referer: "%%%",
    });
    expect(isSameOriginPost(req)).toBe(false);
  });
});

describe("tenant-scope", () => {
  const clinicA = "11111111-1111-1111-1111-111111111111";
  const clinicB = "22222222-2222-2222-2222-222222222222";

  it("assertSameClinic throws on mismatch", () => {
    expect(() => assertSameClinic(clinicA, clinicB)).toThrow(TenantScopeError);
    expect(() => assertSameClinic(clinicA, clinicA)).not.toThrow();
  });

  it("isSameClinic and requireResourceInClinic", () => {
    expect(isSameClinic(clinicA, clinicA)).toBe(true);
    expect(isSameClinic(clinicA, null)).toBe(false);
    expect(requireResourceInClinic(clinicA, clinicA)).toEqual({ ok: true });
    expect(requireResourceInClinic(clinicA, clinicB)).toEqual({
      ok: false,
      error: "Recurso fuera del consultorio activo",
    });
  });

  it("clinicScopedIdFilter returns standard pair", () => {
    expect(clinicScopedIdFilter(clinicA, "pid")).toEqual({
      clinic_id: clinicA,
      id: "pid",
    });
  });
});

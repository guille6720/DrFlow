import type { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { isSameOriginPost } from "@/core/security/csrf";

function mockRequest(headers: Record<string, string>): NextRequest {
  return {
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? null,
    },
  } as NextRequest;
}

describe("isSameOriginPost", () => {
  it("accepts matching origin host", () => {
    const req = mockRequest({
      host: "drflow.example.com",
      origin: "https://drflow.example.com",
    });
    expect(isSameOriginPost(req)).toBe(true);
  });

  it("accepts matching referer when origin absent", () => {
    const req = mockRequest({
      host: "drflow.example.com",
      referer: "https://drflow.example.com/dashboard",
    });
    expect(isSameOriginPost(req)).toBe(true);
  });

  it("rejects when origin host mismatches", () => {
    const req = mockRequest({
      host: "drflow.example.com",
      origin: "https://evil.example.com",
    });
    expect(isSameOriginPost(req)).toBe(false);
  });

  it("rejects invalid origin URL", () => {
    const req = mockRequest({
      host: "drflow.example.com",
      origin: "not-a-url",
    });
    expect(isSameOriginPost(req)).toBe(false);
  });

  it("rejects when host header missing", () => {
    const req = mockRequest({ origin: "https://drflow.example.com" });
    expect(isSameOriginPost(req)).toBe(false);
  });

  it("rejects when neither origin nor referer present", () => {
    const req = mockRequest({ host: "drflow.example.com" });
    expect(isSameOriginPost(req)).toBe(false);
  });
});

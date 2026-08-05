import { describe, expect, it } from "vitest";

import {
  buildPageMeta,
  encodeDescCursor,
  offsetRange,
  parseDescCursor,
  parsePageParam,
} from "@/core/supabase/pagination";

describe("pagination utils", () => {
  it("parsePageParam defaults invalid values to 1", () => {
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("-3")).toBe(1);
    expect(parsePageParam("2.9")).toBe(2);
  });

  it("offsetRange returns inclusive Supabase bounds", () => {
    expect(offsetRange(1, 20)).toEqual({ from: 0, to: 19 });
    expect(offsetRange(3, 25)).toEqual({ from: 50, to: 74 });
  });

  it("buildPageMeta clamps page within total pages", () => {
    expect(buildPageMeta(95, 2, 25)).toEqual({
      page: 2,
      pageSize: 25,
      total: 95,
      totalPages: 4,
    });
    expect(buildPageMeta(0, 5, 20).totalPages).toBe(1);
  });

  it("encodes and parses desc cursors", () => {
    const cursor = encodeDescCursor("2026-01-15T10:00:00Z", "abc-123");
    expect(parseDescCursor(cursor)).toEqual({
      sortValue: "2026-01-15T10:00:00Z",
      id: "abc-123",
    });
    expect(parseDescCursor("invalid")).toBeNull();
  });
});

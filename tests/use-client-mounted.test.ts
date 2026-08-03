import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useClientMounted } from "@/lib/hooks/use-client-mounted";

describe("useClientMounted", () => {
  it("returns true in jsdom (client snapshot)", () => {
    const { result } = renderHook(() => useClientMounted());
    expect(result.current).toBe(true);
  });
});

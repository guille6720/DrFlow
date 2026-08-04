import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readReducedMotionPreference } from "@/lib/accessibility/read-reduced-motion";
import { REDUCED_MOTION_STORAGE_KEY } from "@/lib/accessibility/constants";

describe("readReducedMotionPreference", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: query.includes("reduce"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns true when localStorage preference is true", () => {
    localStorage.setItem(REDUCED_MOTION_STORAGE_KEY, "true");
    expect(readReducedMotionPreference()).toBe(true);
  });

  it("returns false when localStorage explicitly disables reduced motion", () => {
    localStorage.setItem(REDUCED_MOTION_STORAGE_KEY, "false");
    expect(readReducedMotionPreference()).toBe(false);
  });
});

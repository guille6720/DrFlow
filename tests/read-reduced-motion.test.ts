import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { REDUCED_MOTION_STORAGE_KEY } from "@/core/accessibility/constants";
import { readReducedMotionPreference } from "@/core/accessibility/read-reduced-motion";

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

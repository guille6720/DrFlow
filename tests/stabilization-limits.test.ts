import { describe, expect, it } from "vitest";

import {
  isWithinStabilizationLimit,
  STABILIZATION_COMPONENT_MAX_LINES,
  STABILIZATION_HOOK_MAX_LINES,
  stabilizationLimit,
} from "@/shared/utils/stabilization-limits";

describe("stabilization-limits", () => {
  it("defines enterprise line caps", () => {
    expect(STABILIZATION_COMPONENT_MAX_LINES).toBe(200);
    expect(STABILIZATION_HOOK_MAX_LINES).toBe(150);
  });

  it("evaluates component limits", () => {
    expect(isWithinStabilizationLimit(200, "component")).toBe(true);
    expect(isWithinStabilizationLimit(201, "component")).toBe(false);
    expect(stabilizationLimit("component")).toBe(200);
  });

  it("evaluates hook limits", () => {
    expect(isWithinStabilizationLimit(150, "hook")).toBe(true);
    expect(isWithinStabilizationLimit(151, "hook")).toBe(false);
    expect(stabilizationLimit("hook")).toBe(150);
  });
});

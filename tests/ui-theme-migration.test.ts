import { describe, expect, it } from "vitest";

import {
  migrateLegacyAppearanceMode,
  migrateLegacyStyleId,
  resolveClinicalDark,
} from "@/core/theme/ui-theme";

describe("official palette migration", () => {
  it("maps legacy style ids to Clinical Blue or Medical Slate", () => {
    expect(migrateLegacyStyleId("2")).toBe("clinical-blue");
    expect(migrateLegacyStyleId("clinical")).toBe("clinical-blue");
    expect(migrateLegacyStyleId("6")).toBe("medical-slate");
    expect(migrateLegacyStyleId("midnight")).toBe("medical-slate");
    expect(migrateLegacyStyleId("3")).toBe("clinical-blue");
    expect(migrateLegacyStyleId("4")).toBe("clinical-blue");
    expect(migrateLegacyStyleId("5")).toBe("clinical-blue");
    expect(migrateLegacyStyleId("1")).toBe("clinical-blue");
    expect(migrateLegacyStyleId(null)).toBe("clinical-blue");
  });

  it("maps legacy clinical-dark to appearance mode", () => {
    expect(migrateLegacyAppearanceMode(null, "1")).toBe("dark");
    expect(migrateLegacyAppearanceMode(null, "0")).toBe("light");
    expect(migrateLegacyAppearanceMode(null, null)).toBe("system");
    expect(migrateLegacyAppearanceMode("system", "1")).toBe("system");
  });

  it("resolves system dark from prefersDark", () => {
    expect(resolveClinicalDark("light")).toBe(false);
    expect(resolveClinicalDark("dark")).toBe(true);
    expect(resolveClinicalDark("system", true)).toBe(true);
    expect(resolveClinicalDark("system", false)).toBe(false);
  });
});

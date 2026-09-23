import { describe, expect, it } from "vitest";

import { isPublicLightPath } from "@/core/theme/ui-theme";

describe("isPublicLightPath", () => {
  it("treats auth and invite routes as light", () => {
    expect(isPublicLightPath("/login")).toBe(true);
    expect(isPublicLightPath("/register")).toBe(true);
    expect(isPublicLightPath("/acceso-invitado")).toBe(true);
    expect(isPublicLightPath("/acceso-invitado/abc")).toBe(true);
    expect(isPublicLightPath("/auth/callback")).toBe(true);
    expect(isPublicLightPath("/auth/complete")).toBe(true);
  });

  it("keeps dashboard on app theme", () => {
    expect(isPublicLightPath("/dashboard")).toBe(false);
    expect(isPublicLightPath("/configuracion")).toBe(false);
  });
});

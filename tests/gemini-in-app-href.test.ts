import { describe, expect, it } from "vitest";

import { GEMINI_IN_APP_HREF } from "@/features/ia/constants/gemini-web-app";

describe("GEMINI_IN_APP_HREF", () => {
  it("stays inside NexClinic and never points to gemini.google.com", () => {
    expect(GEMINI_IN_APP_HREF).toBe("/gemini");
    expect(GEMINI_IN_APP_HREF).not.toMatch(/gemini\.google\.com/);
  });
});

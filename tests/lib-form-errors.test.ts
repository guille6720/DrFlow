import { describe, expect, it } from "vitest";
import { firstFieldError, normalizeSlug, zodFieldErrors } from "@/core/validations/form-errors";
import { z } from "zod";

describe("form-errors", () => {
  it("maps zod issues to field errors", () => {
    const schema = z.object({ email: z.string().email(), name: z.string().min(2) });
    const parsed = schema.safeParse({ email: "bad", name: "a" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const fields = zodFieldErrors(parsed.error);
      expect(fields.email).toBeTruthy();
      expect(firstFieldError(fields)).toBeTruthy();
    }
  });

  it("normalizes slugs", () => {
    expect(normalizeSlug("  Dr Flow Demo  ")).toBe("dr-flow-demo");
    expect(normalizeSlug("Turnos@2026!!")).toBe("turnos2026");
  });
});

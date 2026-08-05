import { describe, expect, it } from "vitest";

import { normalizeSlug, zodFieldErrors } from "@/core/validations/form-errors";
import { registerClinicSchema } from "@/core/validations/schemas";

describe("register validation", () => {
  it("flags invalid slug with field error", () => {
    const result = registerClinicSchema.safeParse({
      clinicName: "Mi Clínica",
      slug: "Mi Clinica",
      email: "test@email.com",
      password: "12345678",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = zodFieldErrors(result.error);
      expect(errors.slug).toBeDefined();
    }
  });

  it("normalizes slug", () => {
    expect(normalizeSlug("Mi Clínica Norte")).toBe("mi-clnica-norte");
    expect(normalizeSlug("centro_medico")).toBe("centromedico");
  });
});

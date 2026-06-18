import { describe, it, expect } from "vitest";
import { registerClinicSchema } from "@/lib/validations/schemas";
import { normalizeSlug, zodFieldErrors } from "@/lib/validations/form-errors";

describe("register validation", () => {
  it("flags invalid slug with field error", () => {
    const result = registerClinicSchema.safeParse({
      clinicName: "Mi Clínica",
      slug: "Mi Clinica",
      fullName: "Juan Pérez",
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

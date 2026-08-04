import { describe, expect, it } from "vitest";
import { isAdminOnlyPatientRole } from "@/features/pacientes/services/patients.service";

describe("patients.service", () => {
  it("treats secretary as admin-only for patient PHI fields", () => {
    expect(isAdminOnlyPatientRole("secretary", false)).toBe(true);
  });

  it("allows doctors full patient form", () => {
    expect(isAdminOnlyPatientRole("doctor", false)).toBe(false);
  });

  it("superadmin bypasses admin-only restriction", () => {
    expect(isAdminOnlyPatientRole("secretary", true)).toBe(false);
  });
});
